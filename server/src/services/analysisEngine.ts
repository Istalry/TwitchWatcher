/**
 * The batching/analysis engine. It only knows its dependencies through `AnalysisQueueDeps`,
 * so tests can run it with fakes; `analysisQueue.ts` builds the app singleton.
 */
import type { ModerationSettings } from '../store/settings';
import { ChatUser, PendingAction, Platform, UserNote, userKey } from '../store/types';
import { IncomingMessage } from '../platforms/types';
import type { Verdict } from './ai/aiService';
import { disallowedLinks } from './linkDetector';
import {
    ESCALATION_WINDOW_MS, FloodBreaker, buildAction, routeVerdict,
} from './moderationPipeline';

interface QueuedUser {
    platform: Platform;
    userId: string;
    username: string;
    displayName: string;
    messages: { id: string; content: string }[];
}

export interface AnalysisStats {
    analyzed: number; // verdicts in the rolling window
    flagged: number;
    flagRate: number | null; // null until enough samples
    floodActive: boolean;
    effectiveMinSeverity: number;
}

/** What the queue needs from the rest of the app (the singletons in the app, fakes in tests). */
export interface AnalysisQueueDeps {
    settings: () => ModerationSettings;
    history: {
        getUser(key: string): ChatUser | undefined;
        addNote(key: string, note: Omit<UserNote, 'id' | 'timestamp'>): UserNote | undefined;
        noteCount(key: string, windowMs?: number, minSeverity?: number): number;
    };
    actions: { addOrAppend(action: PendingAction): PendingAction };
    ai: { analyzeMessage(message: string, history: string[], platform?: Platform): Promise<Verdict> };
    /** Start the 500 ms tick in the constructor (false in tests: drive `processNext()` by hand). */
    autoStart?: boolean;
    /** Minimum gap between two AI calls. */
    minIntervalMs?: number;
}

export class AnalysisQueue {
    private queue: Map<string, QueuedUser> = new Map();
    private queueOrder: string[] = []; // Maintain order of users
    private processing = false;
    private lastProcessTime = 0;
    private interval: NodeJS.Timeout | null = null;
    private readonly flood = new FloodBreaker();
    private readonly deps: Required<AnalysisQueueDeps>;

    constructor(deps: AnalysisQueueDeps) {
        this.deps = { autoStart: true, minIntervalMs: 2000, ...deps };
        if (this.deps.autoStart) this.start();
    }

    public add(msg: IncomingMessage, storedMessageId: string) {
        const moderation = this.deps.settings();
        if (moderation.skipTrustedRoles && (msg.role === 'broadcaster' || msg.role === 'moderator')) {
            return;
        }

        const key = userKey(msg.platform, msg.userId);
        const subject = { platform: msg.platform, userId: msg.userId, username: msg.username, displayName: msg.displayName };

        // Deterministic link policy: a plain URL never needs the AI. The card still needs the streamer's approval;
        // approving deletes the message and times out ('suppress') or bans ('ban') the user.
        if (moderation.links !== 'allow') {
            const hits = disallowedLinks(msg.content, moderation.linkAllowlist);
            if (hits.length > 0) {
                const domains = hits.map(h => h.domain).join(', ');
                console.log(`LINK [${msg.displayName}@${msg.platform}] ${domains}: ${msg.content}`);
                this.deps.actions.addOrAppend(buildAction({
                    key,
                    entry: subject,
                    text: msg.content,
                    messageIds: [storedMessageId],
                    reason: `Link: ${domains}`,
                    category: 'spam',
                    severity: 3,
                    suggestedAction: moderation.links === 'ban' ? 'ban' : 'timeout',
                    source: 'link',
                    deleteMessages: true,
                }));
                return;
            }
        }

        const entry = this.queue.get(key);
        if (entry) {
            // User already in queue, append message
            entry.messages.push({ id: storedMessageId, content: msg.content });
        } else {
            this.queue.set(key, { ...subject, messages: [{ id: storedMessageId, content: msg.content }] });
            this.queueOrder.push(key);
        }
    }

    /** Users waiting for an AI verdict. */
    public get pendingUsers(): number {
        return this.queueOrder.length;
    }

    public stats(): AnalysisStats {
        return {
            ...this.flood.stats(),
            effectiveMinSeverity: this.effectiveMinSeverity(),
        };
    }

    private effectiveMinSeverity(): number {
        return this.flood.effectiveMinSeverity(this.deps.settings().sensitivity);
    }

    private start() {
        if (this.interval) clearInterval(this.interval);
        // Check queue every 500ms, but enforce the AI rate limit in processNext()
        this.interval = setInterval(() => this.processNext(), 500);
    }

    public stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
    }

    /** Sends the next batched user to the AI (rate limited). Returns true when a user was processed. */
    public async processNext(): Promise<boolean> {
        if (this.processing) return false;
        if (this.queueOrder.length === 0) return false;
        if (Date.now() - this.lastProcessTime < this.deps.minIntervalMs) return false;

        this.processing = true;
        const key = this.queueOrder.shift()!;
        const entry = this.queue.get(key);
        this.queue.delete(key); // Remove from batched map

        if (!entry || entry.messages.length === 0) {
            this.processing = false;
            return false;
        }

        try {
            // Batch messages: "Hello world . Another message"
            const textToAnalyze = entry.messages.map(m => m.content).join(' . ');

            // Get user history for context
            const user = this.deps.history.getUser(key);
            const historyContext = user ? user.messages.map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.content}`) : [];

            const verdict = await this.deps.ai.analyzeMessage(textToAnalyze, historyContext, entry.platform);
            const floodChange = this.flood.record(verdict.flagged);
            if (floodChange === 'on') {
                const { flagRate } = this.flood.stats();
                console.warn(`[AnalysisQueue] Flood breaker ON: AI flagged ${((flagRate ?? 0) * 100).toFixed(0)}% of recent messages. Raising threshold by 1.`);
            } else if (floodChange === 'off') {
                console.log('[AnalysisQueue] Flood breaker OFF: flag rate back to normal.');
            }

            if (!verdict.flagged) {
                console.log(`SAFE [${entry.displayName}@${entry.platform}]: ${textToAnalyze}`);
            } else {
                this.routeFlag(key, entry, textToAnalyze, verdict);
            }
        } catch (err) {
            console.error(`Error processing queue for ${key}:`, err);
        } finally {
            this.lastProcessTime = Date.now();
            this.processing = false;
        }
        return true;
    }

    /** Applies the routing decision: queue card or note on the user. */
    private routeFlag(key: string, entry: QueuedUser, text: string, verdict: Verdict) {
        const { categories } = this.deps.settings();
        const messageIds = entry.messages.map(m => m.id);
        const reason = verdict.reason || 'Unknown';
        const minSeverity = this.effectiveMinSeverity();

        const decision = routeVerdict(verdict, {
            minSeverity,
            categories,
            recentNearMissNotes: this.deps.history.noteCount(key, ESCALATION_WINDOW_MS, minSeverity - 1),
            totalNearMissNotes: this.deps.history.noteCount(key, undefined, minSeverity - 1),
        });

        if (decision.target === 'note') {
            console.log(`NOTE [${entry.displayName}@${entry.platform}] sev ${verdict.severity}/${minSeverity} ${verdict.category}: ${text} (${reason})`);
            this.deps.history.addNote(key, { severity: verdict.severity, category: verdict.category, reason, messageIds });
            return;
        }

        const flaggedReason = decision.escalated ? `Repeated: ${reason}` : reason;
        console.log(`FLAGGED [${entry.displayName}@${entry.platform}] sev ${verdict.severity} ${verdict.category}: ${text} (${flaggedReason})`);

        this.deps.actions.addOrAppend(buildAction({
            key,
            entry,
            text,
            messageIds,
            reason: flaggedReason,
            category: verdict.category,
            severity: verdict.severity,
            suggestedAction: verdict.suggestedAction === 'ban' ? 'ban' : 'timeout',
            source: 'ai',
        }));
    }
}
