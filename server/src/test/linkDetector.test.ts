import { describe, expect, it } from 'vitest';
import { disallowedLinks, extractLinks, isAllowed } from '../services/linkDetector';

const domains = (text: string) => extractLinks(text).map(l => l.domain);

describe('extractLinks', () => {
    it('finds scheme and www links', () => {
        expect(domains('check https://bit.ly/abc now')).toEqual(['bit.ly']);
        expect(domains('go to www.Example.com/path?x=1')).toEqual(['example.com']);
        expect(domains('HTTP://Sub.Domain.ORG:8080/a')).toEqual(['sub.domain.org']);
    });

    it('finds bare domains with a known TLD', () => {
        expect(domains('join discord.gg/xyz')).toEqual(['discord.gg']);
        expect(domains('my site is coolstuff.store!')).toEqual(['coolstuff.store']);
        expect(domains('clips.twitch.tv/Abc')).toEqual(['clips.twitch.tv']);
    });

    it('finds IPv4 addresses with an optional port', () => {
        expect(domains('server 192.168.1.10:25565 is up')).toEqual(['192.168.1.10']);
        expect(domains('999.1.1.1 is not an ip')).toEqual([]);
    });

    it('ignores version numbers, abbreviations and unknown TLDs', () => {
        expect(domains('v1.2 released')).toEqual([]);
        expect(domains('1.5x faster, e.g. this. i.e. that.')).toEqual([]);
        expect(domains('hello.world and file.txt')).toEqual([]);
        expect(domains('email me at someone@gmail.com')).toEqual([]);
    });

    it('strips trailing punctuation and de-duplicates', () => {
        expect(extractLinks('see https://example.com, or example.com.')).toEqual([
            { raw: 'https://example.com', domain: 'example.com' },
        ]);
    });
});

describe('isAllowed', () => {
    it('matches exact and parent domains only', () => {
        expect(isAllowed('twitch.tv', ['twitch.tv'])).toBe(true);
        expect(isAllowed('clips.twitch.tv', ['twitch.tv'])).toBe(true);
        expect(isAllowed('nottwitch.tv', ['twitch.tv'])).toBe(false);
        expect(isAllowed('twitch.tv', ['www.twitch.tv'])).toBe(true);
        expect(isAllowed('twitch.tv', [''])).toBe(false);
    });
});

describe('disallowedLinks', () => {
    it('returns only links outside the allowlist', () => {
        const hits = disallowedLinks('https://youtube.com/watch?v=1 and bit.ly/x', ['youtube.com']);
        expect(hits.map(h => h.domain)).toEqual(['bit.ly']);
    });
});
