import { describe, expect, it } from 'vitest';
import {
    FLOOD_MIN_SAMPLES, FLOOD_WINDOW, FloodBreaker, buildAction, routeVerdict,
} from '../services/moderationPipeline';

const allOn = { hate: true, harassment: true, threat: true, spam: true, vulgarity: true, other: true };
const ctx = (over: Partial<Parameters<typeof routeVerdict>[1]> = {}) => ({
    minSeverity: 3, categories: allOn, recentNearMissNotes: 0, totalNearMissNotes: 0, ...over,
});

describe('routeVerdict', () => {
    it('queues at or above the threshold, notes below', () => {
        expect(routeVerdict({ category: 'harassment', severity: 3 }, ctx()).target).toBe('queue');
        expect(routeVerdict({ category: 'harassment', severity: 2 }, ctx()).target).toBe('note');
        expect(routeVerdict({ category: 'harassment', severity: 2 }, ctx({ minSeverity: 2 })).target).toBe('queue');
        expect(routeVerdict({ category: 'harassment', severity: 3 }, ctx({ minSeverity: 4 })).target).toBe('note');
    });

    it('hard floor beats a disabled category and any threshold', () => {
        const noHate = { ...allOn, hate: false, threat: false };
        expect(routeVerdict({ category: 'hate', severity: 4 }, ctx({ categories: noHate, minSeverity: 5 }))).toEqual({ target: 'queue', hardFloor: true, escalated: false });
        expect(routeVerdict({ category: 'threat', severity: 4 }, ctx({ categories: noHate, minSeverity: 5 })).hardFloor).toBe(true);
        expect(routeVerdict({ category: 'spam', severity: 5 }, ctx({ categories: { ...allOn, spam: false }, minSeverity: 5 })).hardFloor).toBe(true);
        // hate at 3 is not a hard-floor case: small models use "hate" loosely
        expect(routeVerdict({ category: 'hate', severity: 3 }, ctx({ categories: noHate })).target).toBe('note');
    });

    it('drops a disabled category to a note even above the threshold', () => {
        expect(routeVerdict({ category: 'vulgarity', severity: 4 }, ctx({ categories: { ...allOn, vulgarity: false } })).target).toBe('note');
    });

    it('escalates a near-miss only after repeated near-miss notes', () => {
        const nearMiss = { category: 'harassment' as const, severity: 2 };
        expect(routeVerdict(nearMiss, ctx({ recentNearMissNotes: 1 })).target).toBe('note');
        expect(routeVerdict(nearMiss, ctx({ recentNearMissNotes: 2 }))).toEqual({ target: 'queue', hardFloor: false, escalated: true });
        expect(routeVerdict(nearMiss, ctx({ totalNearMissNotes: 3 })).escalated).toBe(true);
        // severity-1 noise never escalates, however many notes there are
        expect(routeVerdict({ category: 'other', severity: 1 }, ctx({ recentNearMissNotes: 5, totalNearMissNotes: 9 })).target).toBe('note');
        // above the threshold is a plain queue, not an escalation
        expect(routeVerdict({ category: 'harassment', severity: 3 }, ctx({ recentNearMissNotes: 2 })).escalated).toBe(false);
    });
});

describe('FloodBreaker', () => {
    const feed = (fb: FloodBreaker, flagged: boolean, n: number) => {
        let last: 'on' | 'off' | null = null;
        for (let i = 0; i < n; i++) last = fb.record(flagged) ?? last;
        return last;
    };

    it('needs a minimum sample before reporting a rate', () => {
        const fb = new FloodBreaker();
        feed(fb, true, FLOOD_MIN_SAMPLES - 1);
        expect(fb.stats().flagRate).toBeNull();
        expect(fb.active).toBe(false);
        fb.record(true);
        expect(fb.stats().flagRate).toBe(1);
        expect(fb.active).toBe(true);
    });

    it('turns on above 50 % and off again below 30 % (hysteresis)', () => {
        const fb = new FloodBreaker();
        expect(feed(fb, true, FLOOD_MIN_SAMPLES)).toBe('on');
        // 40 % flagged: still on (between the two thresholds)
        feed(fb, false, 30);
        expect(fb.stats().flagRate).toBeCloseTo(20 / 50);
        expect(fb.active).toBe(true);
        expect(feed(fb, false, 10)).toBe('off'); // window slides: 10/50 = 20 %
        expect(fb.active).toBe(false);
    });

    it('keeps a rolling window', () => {
        const fb = new FloodBreaker();
        feed(fb, true, FLOOD_WINDOW + 25);
        expect(fb.stats().analyzed).toBe(FLOOD_WINDOW);
    });

    it('raises the effective threshold by one while active, capped at 5', () => {
        const fb = new FloodBreaker();
        expect(fb.effectiveMinSeverity('lenient')).toBe(4);
        expect(fb.effectiveMinSeverity('balanced')).toBe(3);
        expect(fb.effectiveMinSeverity('strict')).toBe(2);
        feed(fb, true, FLOOD_MIN_SAMPLES);
        expect(fb.effectiveMinSeverity('lenient')).toBe(5);
        expect(fb.effectiveMinSeverity('strict')).toBe(3);
    });
});

describe('buildAction', () => {
    it('produces a pending card and omits optional flags when unset', () => {
        const action = buildAction({
            key: 'twitch:1', entry: { platform: 'twitch', userId: '1', username: 'u', displayName: 'U' },
            text: 'hi', messageIds: ['m1'], reason: 'r', category: 'other', severity: 2, suggestedAction: 'timeout', source: 'ai',
        });
        expect(action).toMatchObject({ userKey: 'twitch:1', status: 'pending', source: 'ai', severity: 2 });
        expect(action).not.toHaveProperty('deleteMessages');
        expect(action).not.toHaveProperty('autoExecuteAt');
        expect(action.id).toMatch(/^[0-9a-f-]{36}$/);
    });
});
