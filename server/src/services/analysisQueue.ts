import { historyStore } from '../store/history';
import { actionQueue } from '../store/actionQueue';
import { settingsStore, Sensitivity } from '../store/settings';
import { PendingAction, Platform, userKey } from '../store/types';
import { IncomingMessage } from '../platforms/types';
import { aiService, Verdict } from './ai/aiService';
import crypto from 'crypto';

const MIN_SEVERITY: Record<Sensitivity, number> = { lenient: 4, balanced: 3, strict: 2 };

// Always reach the queue, whatever the sensitivity/category toggles say:
// severity 5 (explicit slur/threat/doxxing) or a hate/threat verdict of at least this severity.
// Small models use "hate" loosely ("Hate from Ireland"), so the category alone isn't enough.
const HARD_FLOOR_SEVERITY = 5;
const HARD_FLOOR_CATEGORIES = new Set(['hate', 'threat']);
const HARD_FLOOR_CATEGORY_MIN_SEVERITY = 4;

// Per-user escalation: this many notes in the window (or in total) promotes the next flag to the queue.
const ESCALATION_WINDOW_MS = 10 * 60 * 1000;
const ESCALATION_RECENT_NOTES = 2;
const ESCALATION_TOTAL_NOTES = 3;

// Flood breaker: rolling window of verdicts.
const FLOOD_WINDOW = 50;
const FLOOD_MIN_SAMPLES = 20;
const FLOOD_ON_RATE = 0.5;
const FLOOD_OFF_RATE = 0.3;

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

class AnalysisQueue {
    private queue: Map<string, QueuedUser> = new Map();
    private queueOrder: string[] = []; // Maintain order of users
    private processing: boolean = false;
    private lastProcessTime: number = 0;
    private interval: NodeJS.Timeout | null = null;

    private verdictWindow: boolean[] = []; // true = flagged
    private floodActive = false;

    constructor() {
        console.log('AnalysisQueue initialized using aiService.');
        this.start();
    }

    public add(msg: IncomingMessage, storedMessageId: string) {
        const { skipTrustedRoles } = settingsStore.get().moderation;
        if (skipTrustedRoles && (msg.role === 'broadcaster' || msg.role === 'moderator')) {
            return;
        }

        const key = userKey(msg.platform, msg.userId);
        const entry = this.queue.get(key);
        if (entry) {
            // User already in queue, append message
            entry.messages.push({ id: storedMessageId, content: msg.content });
        } else {
            this.queue.set(key, {
                platform: msg.platform,
                userId: msg.userId,
                username: msg.username,
                displayName: msg.displayName,
                messages: [{ id: storedMessageId, content: msg.content }],
            });
            this.queueOrder.push(key);
        }
    }

    public stats(): AnalysisStats {
        const analyzed = this.verdictWindow.length;
        const flagged = this.verdictWindow.filter(Boolean).length;
        return {
            analyzed,
            flagged,
            flagRate: analyzed >= FLOOD_MIN_SAMPLES ? flagged / analyzed : null,
            floodActive: this.floodActive,
            effectiveMinSeverity: this.effectiveMinSeverity(),
        };
    }

    private effectiveMinSeverity(): number {
        const base = MIN_SEVERITY[settingsStore.get().moderation.sensitivity] ?? MIN_SEVERITY.balanced;
        return Math.min(HARD_FLOOR_SEVERITY, base + (this.floodActive ? 1 : 0));
    }

    private recordVerdict(flagged: boolean) {
        this.verdictWindow.push(flagged);
        if (this.verdictWindow.length > FLOOD_WINDOW) this.verdictWindow.shift();

        const { flagRate } = this.stats();
        if (flagRate === null) return;
        if (!this.floodActive && flagRate > FLOOD_ON_RATE) {
            this.floodActive = true;
            console.warn(`[AnalysisQueue] Flood breaker ON: AI flagged ${(flagRate * 100).toFixed(0)}% of recent messages. Raising threshold by 1.`);
        } else if (this.floodActive && flagRate < FLOOD_OFF_RATE) {
            this.floodActive = false;
            console.log('[AnalysisQueue] Flood breaker OFF: flag rate back to normal.');
        }
    }

    private start() {
        if (this.interval) clearInterval(this.interval);
        // Check queue every 500ms, but enforce 2s generic rate limit in process()
        this.interval = setInterval(() => this.process(), 500);
    }

    private async process() {
        if (this.processing) return;
        if (this.queueOrder.length === 0) return;

        const now = Date.now();
        if (now - this.lastProcessTime < 2000) {
            return; // Rate limit: 1 request per 2 seconds
        }

        this.processing = true;
        const key = this.queueOrder.shift(); // Get first user
        if (!key) {
            this.processing = false;
            return;
        }

        const entry = this.queue.get(key);
        this.queue.delete(key); // Remove from batched map

        if (!entry || entry.messages.length === 0) {
            this.processing = false;
            return;
        }

        try {
            // Batch messages: "Hello world . Another message"
            const textToAnalyze = entry.messages.map(m => m.content).join(' . ');

            // Get user history for context
            const user = historyStore.getUser(key);
            const historyContext = user ? user.messages.map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.content}`) : [];

            const verdict = await aiService.analyzeMessage(textToAnalyze, historyContext, entry.platform);
            this.recordVerdict(verdict.flagged);

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
    }

    /** Decides whether a flag becomes a queue card or a note on the user. */
    private routeFlag(key: string, entry: QueuedUser, text: string, verdict: Verdict) {
        const { categories } = settingsStore.get().moderation;
        const messageIds = entry.messages.map(m => m.id);
        const reason = verdict.reason || 'Unknown';

        const hardFloor = verdict.severity >= HARD_FLOOR_SEVERITY
            || (HARD_FLOOR_CATEGORIES.has(verdict.category) && verdict.severity >= HARD_FLOOR_CATEGORY_MIN_SEVERITY);
        const categoryEnabled = categories[verdict.category] !== false;
        const minSeverity = this.effectiveMinSeverity();
        const aboveThreshold = verdict.severity >= minSeverity;
        // Repeated near-misses (one step below the threshold) promote the next near-miss; severity-1 noise never does.
        const nearMiss = verdict.severity >= minSeverity - 1;
        const escalated = nearMiss && (
            historyStore.noteCount(key, ESCALATION_WINDOW_MS, minSeverity - 1) >= ESCALATION_RECENT_NOTES ||
            historyStore.noteCount(key, undefined, minSeverity - 1) >= ESCALATION_TOTAL_NOTES);

        const toQueue = hardFloor || (categoryEnabled && (aboveThreshold || escalated));

        if (!toQueue) {
            console.log(`NOTE [${entry.displayName}@${entry.platform}] sev ${verdict.severity}/${minSeverity} ${verdict.category}: ${text} (${reason})`);
            historyStore.addNote(key, { severity: verdict.severity, category: verdict.category, reason, messageIds });
            return;
        }

        const flaggedReason = !hardFloor && !aboveThreshold && escalated ? `Repeated: ${reason}` : reason;
        console.log(`FLAGGED [${entry.displayName}@${entry.platform}] sev ${verdict.severity} ${verdict.category}: ${text} (${flaggedReason})`);

        const action: PendingAction = {
            id: crypto.randomUUID(),
            platform: entry.platform,
            userId: entry.userId,
            userKey: key,
            username: entry.username,
            displayName: entry.displayName,
            messageContent: text,
            messageIds,
            flaggedReason,
            category: verdict.category,
            severity: verdict.severity,
            suggestedAction: verdict.suggestedAction === 'ban' ? 'ban' : 'timeout',
            timestamp: Date.now(),
            status: 'pending',
        };
        actionQueue.addOrAppend(action);
    }
}

export const analysisQueue = new AnalysisQueue();
