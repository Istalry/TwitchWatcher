import { EventEmitter } from 'events';
import { PendingAction } from './types';

// A coalesced card keeps the most recent messages/reasons only, so a flood stays readable.
const MAX_COALESCED_MESSAGES = 8;
const MAX_COALESCED_REASONS = 3;

export type ActionEvent =
    | { type: 'added'; action: PendingAction }
    | { type: 'updated'; action: PendingAction }
    | { type: 'resolved'; action: PendingAction };

/**
 * In-memory queue of AI flags awaiting human review.
 * Emits `'change'` with an ActionEvent so the SSE stream can push updates.
 */
export class ActionQueue extends EventEmitter {
    private queue: PendingAction[] = [];

    public add(action: PendingAction) {
        this.queue.push(action);
        this.emit('change', { type: 'added', action } satisfies ActionEvent);
    }

    /**
     * Folds a new flag into the user's existing pending card when there is one,
     * so a flood from one user produces a single card. Returns the resulting action.
     */
    public addOrAppend(action: PendingAction): PendingAction {
        const existing = this.queue.find(a => a.status === 'pending' && a.userKey === action.userKey);
        if (!existing) {
            this.add(action);
            return action;
        }
        existing.messageContent = [...existing.messageContent.split(' . '), ...action.messageContent.split(' . ')]
            .slice(-MAX_COALESCED_MESSAGES).join(' . ');
        existing.messageIds = [...existing.messageIds, ...action.messageIds].slice(-MAX_COALESCED_MESSAGES * 2);
        const reasons = existing.flaggedReason.split(' | ');
        if (!reasons.includes(action.flaggedReason)) {
            existing.flaggedReason = [...reasons, action.flaggedReason].slice(-MAX_COALESCED_REASONS).join(' | ');
        }
        existing.severity = Math.max(existing.severity, action.severity);
        if (action.suggestedAction === 'ban') existing.suggestedAction = 'ban';
        existing.timestamp = action.timestamp;
        this.emit('change', { type: 'updated', action: existing } satisfies ActionEvent);
        return existing;
    }

    public getPending(): PendingAction[] {
        return this.queue.filter(a => a.status === 'pending');
    }


    public resolve(id: string, resolution: 'approved' | 'discarded') {
        const action = this.queue.find(a => a.id === id);
        if (action) {
            action.status = resolution;
            this.emit('change', { type: 'resolved', action } satisfies ActionEvent);
        }
    }

    public get(id: string) {
        return this.queue.find(a => a.id === id);
    }
}

export const actionQueue = new ActionQueue();
