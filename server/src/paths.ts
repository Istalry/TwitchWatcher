import fs from 'fs';
import path from 'path';

/**
 * Directory where settings.json / users.json live.
 * - packaged exe (pkg): next to the executable
 * - otherwise: the server package root, found by walking up from this file
 *   (works for ts-node in src/, tsc output in dist/store/, and the esbuild bundle in dist/)
 */
function resolveDataDir(): string {
    if ((process as any).pkg) return path.dirname(process.execPath);
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return path.join(__dirname, '../../');
}

export const DATA_DIR = resolveDataDir();
