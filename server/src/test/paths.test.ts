import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateLegacyDataFiles } from '../paths';

let root: string;
let from: string;
let to: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-paths-'));
    from = path.join(root, 'exe');
    to = path.join(root, 'appdata');
    fs.mkdirSync(from);
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('migrateLegacyDataFiles', () => {
    it('moves files that only exist next to the exe and creates the target dir', () => {
        fs.writeFileSync(path.join(from, 'settings.json'), '{"a":1}');
        fs.writeFileSync(path.join(from, 'users.json'), '[]');

        const result = migrateLegacyDataFiles(from, to);

        expect(result).toEqual({ moved: ['settings.json', 'users.json'], skipped: [] });
        expect(fs.readFileSync(path.join(to, 'settings.json'), 'utf-8')).toBe('{"a":1}');
        expect(fs.existsSync(path.join(from, 'settings.json'))).toBe(false);
        expect(fs.existsSync(path.join(from, 'users.json'))).toBe(false);
    });

    it('never overwrites a file already in the target dir', () => {
        fs.mkdirSync(to);
        fs.writeFileSync(path.join(from, 'settings.json'), 'old');
        fs.writeFileSync(path.join(to, 'settings.json'), 'new');

        const result = migrateLegacyDataFiles(from, to);

        expect(result).toEqual({ moved: [], skipped: ['settings.json'] });
        expect(fs.readFileSync(path.join(to, 'settings.json'), 'utf-8')).toBe('new');
        expect(fs.readFileSync(path.join(from, 'settings.json'), 'utf-8')).toBe('old');
    });

    it('is a no-op when both dirs are the same or nothing exists', () => {
        expect(migrateLegacyDataFiles(from, from)).toEqual({ moved: [], skipped: [] });
        expect(migrateLegacyDataFiles(from, to)).toEqual({ moved: [], skipped: [] });
        expect(fs.existsSync(to)).toBe(false);
    });
});
