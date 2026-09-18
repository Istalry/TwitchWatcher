import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisQueue, AnalysisQueueDeps } from '../services/analysisEngine';
import { ActionQueue } from '../store/actionQueue';
import type { ModerationSettings } from '../store/settings';
import type { ChatUser, Platform, UserNote } from '../store/types';
import type { IncomingMessage } from '../platforms/types';
import type { Verdict } from '../services/ai/aiService';

const baseModeration: ModerationSettings = {
    sensitivity: 'balanced',
    categories: { hate: true, harassment: true, threat: true, spam: true, vulgarity: true, other: true },
    skipTrustedRoles: true,
    links: 'allow',
    linkAllowlist: [],
    linksAuto: false,
    rules: [],
    autoEnabled: false,
    autoGraceSeconds: 10,
};

const msg = (over: Partial<IncomingMessage> = {}): IncomingMessage => ({
    platform: 'twitch', userId: '42', username: 'troll', displayName: 'Troll',
    content: 'hello', timestamp: Date.now(), messageId: 'm1', ...over,
});

class FakeHistory {
    users = new Map<string, ChatUser>();
    notes: { key: string; note: Omit<UserNote, 'id' | 'timestamp'> }[] = [];
    counts: Record<string, number> = {};
    getUser(key: string) { return this.users.get(key); }
    addNote(key: string, note: Omit<UserNote, 'id' | 'timestamp'>) { this.notes.push({ key, note }); return undefined; }
    noteCount(key: string) { return this.counts[key] ?? 0; }
}

function setup(over: { moderation?: Partial<ModerationSettings>; verdicts?: Verdict[] } = {}) {
    const moderation = { ...baseModeration, ...over.moderation };
    const verdicts = [...(over.verdicts ?? [])];
    const ai = { analyzeMessage: vi.fn(async (_text: string, _history: string[], _platform?: Platform): Promise<Verdict> => verdicts.shift() ?? { flagged: false, category: 'other', severity: 1 }) };
    const history = new FakeHistory();
    const actions = new ActionQueue();
    const deps: AnalysisQueueDeps = { settings: () => moderation, history, actions, ai, autoStart: false, minIntervalMs: 0 };
    return { queue: new AnalysisQueue(deps), ai, history, actions };
}

describe('AnalysisQueue', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('batches a user\'s messages into one AI call and does nothing when safe', async () => {
        const { queue, ai, actions, history } = setup();
        queue.add(msg({ content: 'hi' }), 'a');
        queue.add(msg({ content: 'there' }), 'b');
        expect(queue.pendingUsers).toBe(1);

        expect(await queue.processNext()).toBe(true);
        expect(ai.analyzeMessage).toHaveBeenCalledTimes(1);
        expect(ai.analyzeMessage.mock.calls[0][0]).toBe('hi . there');
        expect(actions.getPending()).toEqual([]);
        expect(history.notes).toEqual([]);
        expect(await queue.processNext()).toBe(false);
    });

    it('turns a flagged verdict above the threshold into a card', async () => {
        const { queue, actions } = setup({ verdicts: [{ flagged: true, category: 'harassment', severity: 4, reason: 'insult', suggestedAction: 'ban' }] });
        queue.add(msg(), 'm1');
        await queue.processNext();

        const [card] = actions.getPending();
        expect(card).toMatchObject({ userKey: 'twitch:42', flaggedReason: 'insult', severity: 4, suggestedAction: 'ban', source: 'ai', messageIds: ['m1'] });
    });

    it('keeps a below-threshold flag as a note, and escalates after repeated near-misses', async () => {
        const nearMiss: Verdict = { flagged: true, category: 'harassment', severity: 2, reason: 'rude' };
        const { queue, actions, history } = setup({ verdicts: [nearMiss, nearMiss] });

        queue.add(msg(), 'm1');
        await queue.processNext();
        expect(actions.getPending()).toEqual([]);
        expect(history.notes).toHaveLength(1);
        expect(history.notes[0].note).toMatchObject({ severity: 2, category: 'harassment', messageIds: ['m1'] });

        history.counts['twitch:42'] = 2; // two near-miss notes in the window
        queue.add(msg(), 'm2');
        await queue.processNext();
        expect(actions.getPending()[0].flaggedReason).toBe('Repeated: rude');
    });

    it('skips broadcaster and moderator messages when skipTrustedRoles is on', async () => {
        const { queue, ai } = setup();
        queue.add(msg({ role: 'broadcaster' }), 'a');
        queue.add(msg({ role: 'moderator', userId: '7' }), 'b');
        expect(queue.pendingUsers).toBe(0);

        const open = setup({ moderation: { skipTrustedRoles: false } });
        open.queue.add(msg({ role: 'moderator' }), 'a');
        expect(open.queue.pendingUsers).toBe(1);
        expect(ai.analyzeMessage).not.toHaveBeenCalled();
    });

    it('turns a non-allowlisted link into a card without calling the AI', () => {
        const { queue, ai, actions } = setup({ moderation: { links: 'ban', linkAllowlist: ['youtube.com'] } });
        queue.add(msg({ content: 'watch https://youtube.com/x' }), 'ok');
        queue.add(msg({ content: 'free skins bit.ly/x', userId: '9' }), 'bad');

        expect(queue.pendingUsers).toBe(1); // only the allowlisted message waits for the AI
        expect(ai.analyzeMessage).not.toHaveBeenCalled();
        const [card] = actions.getPending();
        expect(card).toMatchObject({ userKey: 'twitch:9', flaggedReason: 'Link: bit.ly', suggestedAction: 'ban', deleteMessages: true, source: 'link', category: 'spam' });
    });

    it('coalesces repeated flags from one user into a single card', async () => {
        const v = (reason: string): Verdict => ({ flagged: true, category: 'spam', severity: 3, reason });
        const { queue, actions } = setup({ verdicts: [v('one'), v('two')] });
        queue.add(msg(), 'm1');
        await queue.processNext();
        queue.add(msg(), 'm2');
        await queue.processNext();

        const pending = actions.getPending();
        expect(pending).toHaveLength(1);
        expect(pending[0].flaggedReason).toBe('one | two');
        expect(pending[0].messageIds).toEqual(['m1', 'm2']);
    });

    it('fails open when the AI throws', async () => {
        const { queue, actions } = setup();
        const boom = { analyzeMessage: vi.fn(async () => { throw new Error('down'); }) };
        const q = new AnalysisQueue({ settings: () => baseModeration, history: new FakeHistory(), actions, ai: boom, autoStart: false, minIntervalMs: 0 });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        q.add(msg(), 'm1');
        expect(await q.processNext()).toBe(true);
        expect(actions.getPending()).toEqual([]);
        expect(queue.pendingUsers).toBe(0);
    });

    it('turns a rule hit into a card without the AI, with a countdown only when auto is armed', () => {
        const rule = { id: 'r1', name: 'No caps', enabled: true, type: 'caps' as const, category: 'other' as const, action: 'timeout' as const, deleteMessage: false, auto: true };
        const off = setup({ moderation: { rules: [rule] } });
        off.queue.add(msg({ content: 'STOP SHOUTING AT EVERYONE' }), 'm1');
        expect(off.ai.analyzeMessage).not.toHaveBeenCalled();
        expect(off.actions.getPending()[0]).toMatchObject({ source: 'rule', ruleName: 'No caps', suggestedAction: 'timeout', flaggedReason: 'Rule: No caps (100% caps)' });
        expect(off.actions.getPending()[0].autoExecuteAt).toBeUndefined();
        expect(off.actions.getPending()[0].deleteMessages).toBeUndefined();

        const on = setup({ moderation: { rules: [rule], autoEnabled: true, autoGraceSeconds: 5 } });
        on.queue.add(msg({ content: 'STOP SHOUTING AT EVERYONE' }), 'm1');
        const at = on.actions.getPending()[0].autoExecuteAt!;
        expect(at).toBeGreaterThan(Date.now() + 4000);
        expect(at).toBeLessThanOrEqual(Date.now() + 5000);

        // AI cards never get a countdown, even with the master switch on
        expect(on.queue.pendingUsers).toBe(0);
    });

    it('feeds the earlier messages of the user to the repeat rule', () => {
        const rule = { id: 'r2', name: 'Repeat', enabled: true, type: 'repeat' as const, count: 2, windowSeconds: 60, category: 'spam' as const, action: 'timeout' as const, deleteMessage: true, auto: false };
        const { queue, history, actions } = setup({ moderation: { rules: [rule] } });
        history.users.set('twitch:42', {
            key: 'twitch:42', platform: 'twitch', userId: '42', username: 'troll', displayName: 'Troll', status: 'active', notes: [],
            messages: [
                { id: 'old', platform: 'twitch', userKey: 'twitch:42', username: 'troll', displayName: 'Troll', content: 'buy now', timestamp: Date.now() - 1000 },
                { id: 'm1', platform: 'twitch', userKey: 'twitch:42', username: 'troll', displayName: 'Troll', content: 'buy now', timestamp: Date.now() },
            ],
        });
        queue.add(msg({ content: 'buy now', messageId: 'm1' }), 'm1'); // the current message is already in history
        expect(actions.getPending()[0]?.flaggedReason).toBe('Rule: Repeat (2× in 60 s)');
    });
});
