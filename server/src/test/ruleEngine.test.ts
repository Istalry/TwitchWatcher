import { describe, expect, it } from 'vitest';
import { Rule, evaluateRules, normalizeText, validateRule } from '../services/ruleEngine';

const rule = (over: Partial<Rule>): Rule => ({
    id: 'r', name: 'test', enabled: true, type: 'words', category: 'other', action: 'timeout', deleteMessage: true, auto: false, ...over,
});
const ctx = { recentMessages: [] as { content: string; timestamp: number }[] };

describe('normalizeText', () => {
    it('lowercases, strips accents and collapses whitespace', () => {
        expect(normalizeText('  Ça  Marche\tTRÈS   bien ')).toBe('ca marche tres bien');
    });
});

describe('evaluateRules — words', () => {
    const r = rule({ words: ['free skins', 'Idiot'] });

    it('matches whole words, case- and accent-insensitively', () => {
        expect(evaluateRules([r], 'FREE SKINS here!', ctx)?.detail).toBe('"free skins"');
        expect(evaluateRules([r], 'quel idiöt', ctx)?.detail).toBe('"Idiot"');
        expect(evaluateRules([r], 'idiotic remark', ctx)).toBeNull();
        expect(evaluateRules([r], 'freeskins', ctx)).toBeNull();
    });

    it('ignores disabled rules and empty words', () => {
        expect(evaluateRules([{ ...r, enabled: false }], 'idiot', ctx)).toBeNull();
        expect(evaluateRules([rule({ words: ['', '  '] })], 'anything', ctx)).toBeNull();
    });
});

describe('evaluateRules — regex', () => {
    it('matches a valid pattern and skips an invalid one', () => {
        expect(evaluateRules([rule({ type: 'regex', pattern: 'b[u4]y\\s+followers' })], 'BUY   followers now', ctx)?.detail).toBe('"BUY   followers"');
        expect(evaluateRules([rule({ type: 'regex', pattern: '(' })], 'anything', ctx)).toBeNull();
    });
});

describe('evaluateRules — caps', () => {
    const r = rule({ type: 'caps' }); // defaults: 12 letters, 70 %

    it('flags shouting but not short or mixed messages', () => {
        expect(evaluateRules([r], 'THIS IS A SHOUTED MESSAGE', ctx)?.detail).toBe('100% caps');
        expect(evaluateRules([r], 'LOL', ctx)).toBeNull();
        expect(evaluateRules([r], 'This is Not shouting at all', ctx)).toBeNull();
        expect(evaluateRules([rule({ type: 'caps', minLength: 3, ratio: 0.5 })], 'LOL ok', ctx)?.detail).toBe('60% caps');
    });
});

describe('evaluateRules — repeat', () => {
    const r = rule({ type: 'repeat', count: 3, windowSeconds: 60 });
    const now = 1_000_000;

    it('counts identical (normalized) messages inside the window, including the current one', () => {
        const recent = [
            { content: 'Buy my stuff', timestamp: now - 50_000 },
            { content: 'buy  MY stuff!', timestamp: now - 10_000 },
        ];
        expect(evaluateRules([r], 'buy my stuff', { recentMessages: recent, now })?.detail).toBe('3× in 60 s');
        expect(evaluateRules([r], 'something else', { recentMessages: recent, now })).toBeNull();
        expect(evaluateRules([r], 'buy my stuff', { recentMessages: recent.slice(1), now })).toBeNull();
    });

    it('ignores messages outside the window', () => {
        const recent = [
            { content: 'spam', timestamp: now - 61_000 },
            { content: 'spam', timestamp: now - 62_000 },
        ];
        expect(evaluateRules([r], 'spam', { recentMessages: recent, now })).toBeNull();
    });
});

describe('evaluateRules — order', () => {
    it('returns the first enabled matching rule', () => {
        const rules = [
            rule({ id: 'a', name: 'caps', type: 'caps', enabled: false }),
            rule({ id: 'b', name: 'words', words: ['stuff'] }),
            rule({ id: 'c', name: 'regex', type: 'regex', pattern: 'stuff' }),
        ];
        expect(evaluateRules(rules, 'BUY MY STUFF RIGHT NOW', ctx)?.rule.name).toBe('words');
    });
});

describe('validateRule', () => {
    it('reports the problems', () => {
        expect(validateRule(rule({ words: ['x'] }))).toEqual([]);
        expect(validateRule(rule({ name: ' ', words: [] }))).toEqual(['Name is required', 'At least one word is required']);
        expect(validateRule(rule({ type: 'regex', pattern: '[' }))[0]).toMatch(/Invalid regular expression/);
        expect(validateRule(rule({ type: 'regex', pattern: 'a'.repeat(201) }))).toEqual(['Pattern is longer than 200 characters']);
        expect(validateRule(rule({ type: 'caps', ratio: 1.5 }))).toEqual(['Ratio must be between 0 and 1']);
        expect(validateRule(rule({ type: 'repeat', count: 1 }))).toEqual(['Count must be at least 2']);
    });
});
