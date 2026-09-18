/**
 * Deterministic chat rules (words, regex, caps, repeat). Pure: no stores, no AI.
 * First enabled rule that matches wins, in list order.
 */
import type { ModerationCategory } from '../store/types';

export type RuleType = 'words' | 'regex' | 'caps' | 'repeat';

export interface Rule {
    id: string;
    name: string;
    enabled: boolean;
    type: RuleType;
    /** words: matched as whole words, case- and accent-insensitive. */
    words?: string[];
    /** regex: JavaScript pattern, flags "iu". */
    pattern?: string;
    /** caps: message must be at least this long... */
    minLength?: number;
    /** ...and have at least this share of letters in upper case (0-1). */
    ratio?: number;
    /** repeat: same normalized text at least this many times... */
    count?: number;
    /** ...within this many seconds. */
    windowSeconds?: number;
    category: ModerationCategory;
    action: 'timeout' | 'ban';
    deleteMessage: boolean;
    /** Execute without confirmation after the grace period (needs the master switch). */
    auto: boolean;
}

export const RULE_DEFAULTS = {
    minLength: 12,
    ratio: 0.7,
    count: 3,
    windowSeconds: 60,
} as const;

export const MAX_PATTERN_LENGTH = 200;

export interface RuleContext {
    /** The user's previous messages (newest last), for `repeat`. */
    recentMessages: { content: string; timestamp: number }[];
    now?: number;
}

export interface RuleHit {
    rule: Rule;
    detail: string;
}

/** Lowercase, accents stripped, whitespace collapsed. */
export function normalizeText(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/** normalizeText plus punctuation removed, so "Buy now!!!" and "buy now" count as the same message. */
export function repeatKey(text: string): string {
    return normalizeText(text).replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Returns null when the pattern is acceptable, else the reason it is not. */
export function validatePattern(pattern: string): string | null {
    if (!pattern.trim()) return 'Pattern is empty';
    if (pattern.length > MAX_PATTERN_LENGTH) return `Pattern is longer than ${MAX_PATTERN_LENGTH} characters`;
    try {
        new RegExp(pattern, 'iu');
        return null;
    } catch (err) {
        return err instanceof Error ? err.message : 'Invalid pattern';
    }
}

/** Sanity-checks a rule; returns the problems found (empty when valid). */
export function validateRule(rule: Partial<Rule>): string[] {
    const problems: string[] = [];
    if (!rule.name?.trim()) problems.push('Name is required');
    switch (rule.type) {
        case 'words':
            if (!rule.words?.some(w => w.trim())) problems.push('At least one word is required');
            break;
        case 'regex': {
            const err = validatePattern(rule.pattern ?? '');
            if (err) problems.push(err);
            break;
        }
        case 'caps':
            if (rule.ratio !== undefined && (rule.ratio <= 0 || rule.ratio > 1)) problems.push('Ratio must be between 0 and 1');
            if (rule.minLength !== undefined && rule.minLength < 1) problems.push('Minimum length must be at least 1');
            break;
        case 'repeat':
            if (rule.count !== undefined && rule.count < 2) problems.push('Count must be at least 2');
            if (rule.windowSeconds !== undefined && rule.windowSeconds < 1) problems.push('Window must be at least 1 second');
            break;
        default:
            problems.push('Unknown rule type');
    }
    return problems;
}

function matchWords(rule: Rule, text: string): string | null {
    const normalized = normalizeText(text);
    for (const raw of rule.words ?? []) {
        const word = normalizeText(raw);
        if (!word) continue;
        // (?<![\p{L}\p{N}]) / (?![\p{L}\p{N}]) = whole-word boundaries that work for accented letters too.
        const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(word)}(?![\\p{L}\\p{N}])`, 'u');
        if (re.test(normalized)) return `"${raw}"`;
    }
    return null;
}

function matchRegex(rule: Rule, text: string): string | null {
    if (!rule.pattern || validatePattern(rule.pattern)) return null;
    const m = new RegExp(rule.pattern, 'iu').exec(text);
    return m ? `"${m[0].slice(0, 40)}"` : null;
}

function matchCaps(rule: Rule, text: string): string | null {
    const minLength = rule.minLength ?? RULE_DEFAULTS.minLength;
    const ratio = rule.ratio ?? RULE_DEFAULTS.ratio;
    const letters = Array.from(text).filter(ch => /\p{L}/u.test(ch));
    if (letters.length < minLength) return null;
    const upper = letters.filter(ch => ch !== ch.toLowerCase() && ch === ch.toUpperCase()).length;
    const share = upper / letters.length;
    return share >= ratio ? `${Math.round(share * 100)}% caps` : null;
}

function matchRepeat(rule: Rule, text: string, ctx: RuleContext): string | null {
    const count = rule.count ?? RULE_DEFAULTS.count;
    const windowMs = (rule.windowSeconds ?? RULE_DEFAULTS.windowSeconds) * 1000;
    const now = ctx.now ?? Date.now();
    const target = repeatKey(text);
    if (!target) return null;
    // The current message counts as one; `recentMessages` must not include it.
    const earlier = ctx.recentMessages.filter(m => m.timestamp >= now - windowMs && repeatKey(m.content) === target).length;
    const total = earlier + 1;
    return total >= count ? `${total}× in ${Math.round(windowMs / 1000)} s` : null;
}

export function evaluateRules(rules: Rule[], text: string, ctx: RuleContext): RuleHit | null {
    for (const rule of rules) {
        if (!rule.enabled) continue;
        let detail: string | null = null;
        switch (rule.type) {
            case 'words': detail = matchWords(rule, text); break;
            case 'regex': detail = matchRegex(rule, text); break;
            case 'caps': detail = matchCaps(rule, text); break;
            case 'repeat': detail = matchRepeat(rule, text, ctx); break;
        }
        if (detail) return { rule, detail };
    }
    return null;
}
