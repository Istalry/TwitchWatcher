// Single source of truth for the app version: server/package.json.
// esbuild inlines the JSON into the bundle; ts-node reads it from disk.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json') as { version: string };

export const APP_VERSION: string = pkg.version;
export const GITHUB_REPO = 'Istalry/TwitchWatcher';
export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

/**
 * Compares two semver-ish versions ("2.1.0", "v2.1.0-beta.2").
 * Returns <0 if a < b, 0 if equal, >0 if a > b. A prerelease sorts before its release.
 */
export function compareVersions(a: string, b: string): number {
    const parse = (v: string) => {
        const [core, pre] = v.trim().replace(/^v/i, '').split('-', 2);
        const nums = core.split('.').map(n => parseInt(n, 10) || 0);
        while (nums.length < 3) nums.push(0);
        return { nums, pre: pre ?? null };
    };
    const pa = parse(a);
    const pb = parse(b);
    for (let i = 0; i < 3; i++) {
        if (pa.nums[i] !== pb.nums[i]) return pa.nums[i] - pb.nums[i];
    }
    if (pa.pre === pb.pre) return 0;
    if (pa.pre === null) return 1;
    if (pb.pre === null) return -1;
    const sa = pa.pre.split('.');
    const sb = pb.pre.split('.');
    for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
        if (sa[i] === undefined) return -1;
        if (sb[i] === undefined) return 1;
        const na = parseInt(sa[i], 10);
        const nb = parseInt(sb[i], 10);
        const cmp = !isNaN(na) && !isNaN(nb) ? na - nb : sa[i].localeCompare(sb[i]);
        if (cmp !== 0) return cmp;
    }
    return 0;
}
