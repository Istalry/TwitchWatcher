import { describe, expect, it } from 'vitest';
import { compareVersions } from '../version';

describe('compareVersions', () => {
    it('orders numeric parts', () => {
        expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
        expect(compareVersions('2.0.0', '2.0.1')).toBeLessThan(0);
        expect(compareVersions('v2.1', '2.1.0')).toBe(0);
    });

    it('sorts prereleases before the release', () => {
        expect(compareVersions('2.0.0-beta.1', '2.0.0')).toBeLessThan(0);
        expect(compareVersions('2.0.0', '2.0.0-beta.1')).toBeGreaterThan(0);
        expect(compareVersions('2.0.0-beta.2', '2.0.0-beta.10')).toBeLessThan(0);
        expect(compareVersions('2.0.0-beta.1', '2.0.0-beta.1')).toBe(0);
    });
});
