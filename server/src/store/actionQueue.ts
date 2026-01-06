import { PendingAction } from './types';

export class ActionQueue {
    private queue: PendingAction[] = [];

    public add(action: PendingAction) {
        this.queue.push(action);
    }

    public getPending(): PendingAction[] {
        return this.queue.filter(a => a.status === 'pending');
    }

    public resolve(id: string, resolution: 'approved' | 'discarded') {
        const idx = this.queue.findIndex(a => a.id === id);
        if (idx !== -1) {
            this.queue[idx].status = resolution;
            // Optionally clean up processed items after some time
        }
    }

    public get(id: string) {
        return this.queue.find(a => a.id === id);
    }
}

export const actionQueue = new ActionQueue();
