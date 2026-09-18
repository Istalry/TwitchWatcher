import { describe, expect, it } from 'vitest';
import { staleUserKeys } from '../store/history';
import type { ChatUser } from '../store/types';

const DAY = 24 * 60 * 60 * 1000;
const now = 100 * DAY;

const user = (key: string, lastMessageAgoDays: number, over: Partial<ChatUser> = {}): ChatUser => ({
    key, platform: 'twitch', userId: key, username: key, displayName: key, status: 'active', notes: [],
    messages: [{ id: 'm', platform: 'twitch', userKey: key, username: key, displayName: key, content: 'x', timestamp: now - lastMessageAgoDays * DAY }],
    ...over,
});

describe('staleUserKeys', () => {
    it('returns users inactive for longer than the retention window', () => {
        const users = [user('fresh', 1), user('old', 91), user('edge', 89)];
        expect(staleUserKeys(users, 90, now)).toEqual(['old']);
    });

    it('never prunes when retention is 0 and keeps banned users', () => {
        const users = [user('old', 400), user('banned', 400, { status: 'banned' })];
        expect(staleUserKeys(users, 0, now)).toEqual([]);
        expect(staleUserKeys(users, 30, now)).toEqual(['old']);
    });

    it('counts notes as activity and prunes users with no activity at all', () => {
        const noted = user('noted', 200, { notes: [{ id: 'n', timestamp: now - 2 * DAY, severity: 2, category: 'other', reason: 'r', messageIds: [] }] });
        const empty = user('empty', 0, { messages: [] });
        expect(staleUserKeys([noted, empty], 30, now)).toEqual(['empty']);
    });
});
