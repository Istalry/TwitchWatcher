/**
 * Pure decision logic of the moderation pipeline: no stores, no AI, no timers.
 * `analysisQueue.ts` wires these into the running app; the tests exercise them directly.
 */
import crypto from 'crypto';
import type { Sensitivity } from '../store/settings';
import type { ModerationCategory, PendingAction, Platform } from '../store/types';

export const MIN_SEVERITY: Record<Sensitivity, number> = { lenient: 4, balanced: 3, strict: 2 };

// Always reach the queue, whatever the sensitivity/category toggles say:
// severity 5 (explicit slur/threat/doxxing) or a hate/threat verdict of at least this severity.
// Small models use "hate" loosely ("Hate from Ireland"), so the category alone isn't enough.
export const HARD_FLOOR_SEVERITY = 5;
export const HARD_FLOOR_CATEGORIES: ReadonlySet<string> = new Set(['hate', 'threat']);
export const HARD_FLOOR_CATEGORY_MIN_SEVERITY = 4;

// Per-user escalation: this many near-miss notes in the window (or in total) promotes the next near-miss to the queue.
export const ESCALATION_WINDOW_MS = 10 * 60 * 1000;
export const ESCALATION_RECENT_NOTES = 2;
export const ESCALATION_TOTAL_NOTES = 3;

// Flood breaker: rolling window of verdicts.
export const FLOOD_WINDOW = 50;
export const FLOOD_MIN_SAMPLES = 20;
export const FLOOD_ON_RATE = 0.5;
export const FLOOD_OFF_RATE = 0.3;

export interface VerdictLike {
    category: ModerationCategory;
    severity: number;
}

export interface RouteContext {
    /** Effective threshold (sensitivity + flood breaker). */
    minSeverity: number;
    categories: Partial<Record<ModerationCategory, boolean>>;
    /** Near-miss notes (severity ≥ minSeverity-1) the user already has, recent window / all time. */
    recentNearMissNotes: number;
    totalNearMissNotes: number;
}

export interface RouteDecision {
    target: 'queue' | 'note';
    hardFloor: boolean;
    /** Queued only because of repeated near-misses (reason gets a "Repeated:" prefix). */
    escalated: boolean;
}

/** Decides whether a flagged verdict becomes a queue card or a note on the user. */
export function routeVerdict(verdict: VerdictLike, ctx: RouteContext): RouteDecision {
    const hardFloor = verdict.severity >= HARD_FLOOR_SEVERITY
        || (HARD_FLOOR_CATEGORIES.has(verdict.category) && verdict.severity >= HARD_FLOOR_CATEGORY_MIN_SEVERITY);
    const categoryEnabled = ctx.categories[verdict.category] !== false;
    const aboveThreshold = verdict.severity >= ctx.minSeverity;
    // Repeated near-misses (one step below the threshold) promote the next near-miss; severity-1 noise never does.
    const nearMiss = verdict.severity >= ctx.minSeverity - 1;
    const repeated = nearMiss && (
        ctx.recentNearMissNotes >= ESCALATION_RECENT_NOTES || ctx.totalNearMissNotes >= ESCALATION_TOTAL_NOTES);

    const toQueue = hardFloor || (categoryEnabled && (aboveThreshold || repeated));
    return {
        target: toQueue ? 'queue' : 'note',
        hardFloor,
        escalated: toQueue && !hardFloor && !aboveThreshold && repeated,
    };
}

export interface FloodStats {
    analyzed: number; // verdicts in the rolling window
    flagged: number;
    flagRate: number | null; // null until enough samples
    floodActive: boolean;
}

/** Raises the threshold by one while the model flags more than half of recent chat. */
export class FloodBreaker {
    private window: boolean[] = [];
    private _active = false;

    public get active(): boolean {
        return this._active;
    }

    /** Records a verdict; returns the new state when it changed, else null. */
    public record(flagged: boolean): 'on' | 'off' | null {
        this.window.push(flagged);
        if (this.window.length > FLOOD_WINDOW) this.window.shift();

        const { flagRate } = this.stats();
        if (flagRate === null) return null;
        if (!this._active && flagRate > FLOOD_ON_RATE) {
            this._active = true;
            return 'on';
        }
        if (this._active && flagRate < FLOOD_OFF_RATE) {
            this._active = false;
            return 'off';
        }
        return null;
    }

    public stats(): FloodStats {
        const analyzed = this.window.length;
        const flagged = this.window.filter(Boolean).length;
        return {
            analyzed,
            flagged,
            flagRate: analyzed >= FLOOD_MIN_SAMPLES ? flagged / analyzed : null,
            floodActive: this._active,
        };
    }

    public effectiveMinSeverity(sensitivity: Sensitivity): number {
        const base = MIN_SEVERITY[sensitivity] ?? MIN_SEVERITY.balanced;
        return Math.min(HARD_FLOOR_SEVERITY, base + (this._active ? 1 : 0));
    }
}

export interface ActionSubject {
    platform: Platform;
    userId: string;
    username: string;
    displayName: string;
}

export interface ActionInput {
    key: string;
    entry: ActionSubject;
    text: string;
    messageIds: string[];
    reason: string;
    category: ModerationCategory;
    severity: number;
    suggestedAction: PendingAction['suggestedAction'];
    source: PendingAction['source'];
    ruleName?: string;
    deleteMessages?: boolean;
    autoExecuteAt?: number;
}

export function buildAction(input: ActionInput): PendingAction {
    return {
        id: crypto.randomUUID(),
        platform: input.entry.platform,
        userId: input.entry.userId,
        userKey: input.key,
        username: input.entry.username,
        displayName: input.entry.displayName,
        messageContent: input.text,
        messageIds: input.messageIds,
        flaggedReason: input.reason,
        category: input.category,
        severity: input.severity,
        suggestedAction: input.suggestedAction,
        source: input.source,
        ...(input.ruleName ? { ruleName: input.ruleName } : {}),
        ...(input.deleteMessages ? { deleteMessages: true } : {}),
        ...(input.autoExecuteAt ? { autoExecuteAt: input.autoExecuteAt } : {}),
        timestamp: Date.now(),
        status: 'pending',
    };
}
