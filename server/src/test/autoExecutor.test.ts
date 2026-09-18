import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoExecutor } from '../services/autoExecutor';
import { ActionQueue } from '../store/actionQueue';
import { buildAction } from '../services/moderationPipeline';
import type { PendingAction } from '../store/types';
import type { SanctionRequest, SanctionResult } from '../services/sanctions';

const card = (over: Partial<Parameters<typeof buildAction>[0]> = {}): PendingAction => buildAction({
    key: 'twitch:1', entry: { platform: 'twitch', userId: '1', username: 'u', displayName: 'U' },
    text: 'FREE SKINS', messageIds: ['m1'], reason: 'Rule: caps', category: 'other', severity: 3,
    suggestedAction: 'timeout', source: 'rule', ruleName: 'caps', deleteMessages: true,
    autoExecuteAt: Date.now() + 5000, ...over,
});

const requestFromAction = (action: PendingAction, kind: 'timeout' | 'ban', by: 'streamer' | 'auto'): SanctionRequest => ({
    target: { platform: action.platform, userId: action.userId, displayName: action.displayName },
    kind, reason: action.flaggedReason, source: action.source, by,
});

const okResult = (): SanctionResult => ({ entry: {} as SanctionResult['entry'], deleted: 0, deleteFailures: [] });

function setup(execute = vi.fn(async (_req: SanctionRequest): Promise<SanctionResult> => okResult())) {
    const actions = new ActionQueue();
    const executor = new AutoExecutor({ actions, execute, requestFromAction });
    return { actions, executor, execute };
}

describe('AutoExecutor', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => vi.useRealTimers());

    it('executes the suggested sanction once the grace period elapsed and resolves the card', async () => {
        const { actions, executor, execute } = setup();
        const c = card({ suggestedAction: 'ban' });
        actions.add(c);
        expect(executor.scheduled).toBe(1);

        await vi.advanceTimersByTimeAsync(4999);
        expect(execute).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(2);
        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute.mock.calls[0][0]).toMatchObject({ kind: 'ban', by: 'auto', source: 'rule' });
        expect(actions.get(c.id)?.status).toBe('approved');
        expect(executor.scheduled).toBe(0);
    });

    it('does nothing for cards without a countdown', () => {
        const { actions, executor } = setup();
        actions.add(card({ autoExecuteAt: undefined }));
        expect(executor.scheduled).toBe(0);
    });

    it('respects hold and dismiss', async () => {
        const { actions, executor, execute } = setup();
        const held = card();
        const dismissed = card({ key: 'twitch:2', entry: { platform: 'twitch', userId: '2', username: 'v', displayName: 'V' } });
        actions.add(held);
        actions.add(dismissed);
        expect(executor.scheduled).toBe(2);

        actions.hold(held.id);
        expect(actions.get(held.id)?.autoExecuteAt).toBeUndefined();
        actions.resolve(dismissed.id, 'discarded');
        expect(executor.scheduled).toBe(0);

        await vi.advanceTimersByTimeAsync(10_000);
        expect(execute).not.toHaveBeenCalled();
        expect(actions.get(held.id)?.status).toBe('pending');
    });

    it('on failure keeps the card, without a countdown', async () => {
        const execute = vi.fn(async (_req: SanctionRequest): Promise<SanctionResult> => { throw new Error('Not connected'); });
        const { actions, executor } = setup(execute);
        const c = card();
        actions.add(c);

        await vi.advanceTimersByTimeAsync(5001);
        expect(execute).toHaveBeenCalledTimes(1);
        expect(actions.get(c.id)?.status).toBe('pending');
        expect(actions.get(c.id)?.autoExecuteAt).toBeUndefined();
        expect(executor.scheduled).toBe(0);
    });

    it('does not restart a countdown when a new hit is appended to a held card', async () => {
        const { actions, executor, execute } = setup();
        const c = card();
        actions.add(c);
        actions.hold(c.id);
        actions.addOrAppend(card({ messageIds: ['m2'] })); // same user → appended
        expect(actions.getPending()).toHaveLength(1);
        expect(executor.scheduled).toBe(0);
        await vi.advanceTimersByTimeAsync(10_000);
        expect(execute).not.toHaveBeenCalled();
    });
});
