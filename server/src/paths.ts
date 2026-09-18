import fs from 'fs';
import os from 'os';
import path from 'path';

export const DATA_FILES = ['settings.json', 'users.json', 'bans.json', 'sanctions.json'];

const isPackaged = (): boolean => !!(process as any).pkg;

/** Directory of the running executable (packaged) or the server package root. */
function resolveExeDir(): string {
    if (isPackaged()) return path.dirname(process.execPath);
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return path.join(__dirname, '../../');
}

/** Per-user roaming data folder (%APPDATA%\TwitchWatcher on Windows). */
export function appDataDir(): string {
    const base = process.env.APPDATA
        || (process.platform === 'darwin'
            ? path.join(os.homedir(), 'Library', 'Application Support')
            : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'));
    return path.join(base, 'TwitchWatcher');
}

/**
 * Directory where settings.json / users.json / bans.json live.
 * - packaged exe (pkg): %APPDATA%\TwitchWatcher, so updating/moving the exe never loses data.
 *   A `portable.txt` file next to the exe forces the old "next to the exe" behaviour.
 * - otherwise (ts-node, tsc output, esbuild bundle): the server package root.
 */
function resolveDataDir(exeDir: string): string {
    if (!isPackaged()) return exeDir;
    if (fs.existsSync(path.join(exeDir, 'portable.txt'))) return exeDir;
    return appDataDir();
}

export interface MigrationResult {
    moved: string[];
    skipped: string[]; // present in both places; the destination copy is kept
}

/**
 * Moves a file with progressively dumber fallbacks: rename (cross-volume moves and EFS-encrypted
 * files can refuse it), then CopyFile, then a plain read/write. Never leaves the destination missing.
 */
export function moveFile(src: string, dst: string) {
    try {
        fs.renameSync(src, dst);
        return;
    } catch {
        // fall through
    }
    try {
        fs.copyFileSync(src, dst);
    } catch {
        fs.writeFileSync(dst, fs.readFileSync(src));
    }
    try {
        fs.unlinkSync(src);
    } catch (err) {
        console.warn(`[Data] Copied ${src} to ${dst} but could not delete the original:`, err);
    }
}

/**
 * Moves data files left next to the exe by older versions into the new data dir.
 * Never overwrites: a file that already exists in `toDir` is left alone in both places.
 */
export function migrateLegacyDataFiles(fromDir: string, toDir: string, files: string[] = DATA_FILES): MigrationResult {
    const result: MigrationResult = { moved: [], skipped: [] };
    if (path.resolve(fromDir) === path.resolve(toDir)) return result;

    for (const name of files) {
        const src = path.join(fromDir, name);
        const dst = path.join(toDir, name);
        if (!fs.existsSync(src)) continue;
        if (fs.existsSync(dst)) {
            result.skipped.push(name);
            continue;
        }
        fs.mkdirSync(toDir, { recursive: true });
        moveFile(src, dst);
        result.moved.push(name);
    }
    return result;
}

export const EXE_DIR = resolveExeDir();
export const DATA_DIR = resolveDataDir(EXE_DIR);

if (DATA_DIR !== EXE_DIR) {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        const { moved, skipped } = migrateLegacyDataFiles(EXE_DIR, DATA_DIR);
        for (const name of moved) console.log(`[Data] Moved ${name} from ${EXE_DIR} to ${DATA_DIR}`);
        for (const name of skipped) console.warn(`[Data] ${name} exists both next to the exe and in ${DATA_DIR}; using the latter.`);
    } catch (err) {
        console.error('[Data] Failed to migrate data files:', err);
    }
}
