/**
 * Deterministic URL detection for chat messages. Pure: no imports from stores.
 * Deliberately obfuscated links ("bit(dot)ly", "discord . gg") are NOT matched here;
 * the AI prompt handles those when link moderation is on.
 */

export interface DetectedLink {
    raw: string;
    domain: string; // lowercase hostname without "www."
}

// Explicit TLD list keeps "v1.2", "e.g." and "hello.world" out; extend when a real domain slips through.
const TLDS = 'com|net|org|gg|tv|io|me|ly|co|fr|ca|de|uk|xyz|app|dev|link|live|stream|be|to|us|info|biz|ru|cc|site|online|shop|store|ch|es|it|nl|eu|pl|br|jp|kr|in|au|nz|se|no|fi|dk|at|pt|tk|ml|ga|cf|gq|pw|top|club|fun|win|vip|icu|buzz|monster';

const SCHEME_RE = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
// First label must contain a letter so version numbers ("1.2.3") never match.
const BARE_RE = new RegExp(`(?<![\\w@.-])(?=[a-z0-9-]*[a-z])[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})(?::\\d{2,5})?(?:/[^\\s<>"'\`]*)?(?![\\w-])`, 'gi');
const IPV4_RE = /(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?(?:\/[^\s<>"'`]*)?(?![\w.])/g;

const TRAILING_PUNCT = /[.,;:!?)\]}'"]+$/;

function hostnameOf(raw: string): string {
    let s = raw.replace(TRAILING_PUNCT, '');
    s = s.replace(/^https?:\/\//i, '');
    s = s.split(/[/?#]/)[0];
    s = s.replace(/^[^@]*@/, ''); // user:pass@host
    s = s.replace(/:\d+$/, '');
    s = s.toLowerCase();
    return s.startsWith('www.') ? s.slice(4) : s;
}

function isValidIpv4(host: string): boolean {
    return host.split('.').every(part => Number(part) <= 255);
}

export function extractLinks(text: string): DetectedLink[] {
    const found = new Map<string, DetectedLink>();
    const push = (raw: string) => {
        const cleaned = raw.replace(TRAILING_PUNCT, '');
        const domain = hostnameOf(cleaned);
        if (!domain || domain.includes('..')) return;
        if (/^\d+(\.\d+){3}$/.test(domain) && !isValidIpv4(domain)) return;
        if (!found.has(domain)) found.set(domain, { raw: cleaned, domain });
    };

    for (const m of text.matchAll(SCHEME_RE)) push(m[0]);
    for (const m of text.matchAll(IPV4_RE)) push(m[0]);
    // Strip scheme/www hits first so the bare matcher doesn't re-find their hostnames with a different raw.
    const remainder = text.replace(SCHEME_RE, ' ');
    for (const m of remainder.matchAll(BARE_RE)) push(m[0]);

    return Array.from(found.values());
}

/** True when `domain` equals an allowlisted domain or is a subdomain of one. */
export function isAllowed(domain: string, allowlist: string[]): boolean {
    const d = domain.toLowerCase();
    return allowlist.some(entry => {
        const a = entry.trim().toLowerCase().replace(/^www\./, '');
        return a !== '' && (d === a || d.endsWith(`.${a}`));
    });
}

/** Links in `text` that are not covered by the allowlist. */
export function disallowedLinks(text: string, allowlist: string[]): DetectedLink[] {
    return extractLinks(text).filter(l => !isAllowed(l.domain, allowlist));
}
