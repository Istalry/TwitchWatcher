import { describe, expect, it } from 'vitest';
import { MAX_ENTRIES, SanctionLog } from '../store/sanctionLog';

const entry = (over: Partial<Parameters<SanctionLog['add']>[0]> = {}) => ({
    platform: 'twitch' as const, userId: '1', userKey: 'twitch:1', displayName: 'U',
    action: 'timeout' as const, reason: 'r', source: 'ai' as const, by: 'streamer' as const,
    messageIds: [], messages: ['a', 'b', 'c', 'd'], ...over,
});

describe('SanctionLog', () => {
    it('stores entries newest first, keeps at most 3 snippets', () => {
        const log = new SanctionLog(null);
        const first = log.add(entry({ reason: 'first' }));
        const second = log.add(entry({ reason: 'second' }));

        expect(log.list().map(e => e.reason)).toEqual(['second', 'first']);
        expect(first.messages).toEqual(['a', 'b', 'c']);
        expect(log.get(second.id)?.reason).toBe('second');
        expect(log.list(1)).toHaveLength(1);
    });

    it('caps the journal', () => {
        const log = new SanctionLog(null);
        for (let i = 0; i < MAX_ENTRIES + 10; i++) log.add(entry({ reason: String(i) }));
        expect(log.list(MAX_ENTRIES + 10)).toHaveLength(MAX_ENTRIES);
        expect(log.list(1)[0].reason).toBe(String(MAX_ENTRIES + 9));
    });

    it('marks an entry reverted and counts sanctions since a time', () => {
        const log = new SanctionLog(null);
        const e = log.add(entry());
        log.add(entry({ action: 'unban' }));
        expect(log.markReverted(e.id)?.reverted?.at).toBeGreaterThan(0);
        expect(log.markReverted('nope')).toBeUndefined();
        expect(log.countSince(0)).toBe(1); // unbans don't count
        expect(log.countSince(Date.now() + 1000)).toBe(0);
    });
});
