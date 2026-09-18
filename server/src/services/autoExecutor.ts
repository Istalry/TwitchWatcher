/**
 * Executes cards that carry `autoExecuteAt` once their grace period is over,
 * unless they were held or dismissed in the meantime. Only deterministic hits
 * (links, rules) ever get an `autoExecuteAt`; AI verdicts never do.
 */
import type { ActionQueue } from '../store/actionQueue';
import type { PendingAction } from '../store/types';
import type { SanctionRequest, SanctionResult } from './sanctions';

export interface AutoExecutorDeps {
    actions: Pick<ActionQueue, 'on' | 'get' | 'resolve' | 'hold'>;
    execute: (req: SanctionRequest) => Promise<SanctionResult>;
    requestFromAction: (action: PendingAction, kind: 'timeout' | 'ban', by: 'streamer' | 'auto') => SanctionRequest;
    now?: () => number;
    setTimer?: (fn: () => void, ms: number) => NodeJS.Timeout;
    clearTimer?: (t: NodeJS.Timeout) => void;
}

export class AutoExecutor {
    private timers = new Map<string, NodeJS.Timeout>();
    private readonly deps: Required<AutoExecutorDeps>;

    constructor(deps: AutoExecutorDeps) {
        this.deps = {
            now: () => Date.now(),
            setTimer: (fn, ms) => setTimeout(fn, ms),
            clearTimer: t => clearTimeout(t),
            ...deps,
        };
        this.deps.actions.on('change', (evt: { type: string; action: PendingAction }) => this.onChange(evt));
    }

    private onChange(evt: { type: string; action: PendingAction }) {
        const { action } = evt;
        if (evt.type === 'resolved' || !action.autoExecuteAt || action.status !== 'pending') {
            this.cancel(action.id);
            return;
        }
        this.schedule(action);
    }

    private schedule(action: PendingAction) {
        this.cancel(action.id);
        const delay = Math.max(0, (action.autoExecuteAt ?? 0) - this.deps.now());
        const timer = this.deps.setTimer(() => {
            this.timers.delete(action.id);
            void this.fire(action.id);
        }, delay);
        if (typeof (timer as NodeJS.Timeout).unref === 'function') (timer as NodeJS.Timeout).unref();
        this.timers.set(action.id, timer);
    }

    private cancel(id: string) {
        const timer = this.timers.get(id);
        if (timer) {
            this.deps.clearTimer(timer);
            this.timers.delete(id);
        }
    }

    /** Runs the sanction for a card whose countdown elapsed. Exposed for tests. */
    public async fire(id: string): Promise<boolean> {
        const action = this.deps.actions.get(id);
        // Held (autoExecuteAt cleared), dismissed/approved by hand, or gone: nothing to do.
        if (!action || action.status !== 'pending' || !action.autoExecuteAt) return false;
        if (action.autoExecuteAt > this.deps.now()) {
            this.schedule(action); // countdown was pushed back
            return false;
        }

        const kind = action.suggestedAction === 'ban' ? 'ban' : 'timeout';
        try {
            await this.deps.execute(this.deps.requestFromAction(action, kind, 'auto'));
            this.deps.actions.resolve(id, 'approved');
            console.log(`[auto] Executed ${kind} for ${action.displayName}@${action.platform} (${action.flaggedReason})`);
            return true;
        } catch (err) {
            // Leave the card for the streamer, without a countdown, so the failure is visible.
            console.error(`[auto] ${kind} failed for ${action.displayName}@${action.platform}:`, err instanceof Error ? err.message : err);
            this.deps.actions.hold(id);
            return false;
        }
    }

    /** Pending countdowns (for tests / status). */
    public get scheduled(): number {
        return this.timers.size;
    }
}
