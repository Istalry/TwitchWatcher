// Bundles the server into a single CommonJS file for `pkg`.
// youtubei.js and tiktok-live-connector are ESM-only, which pkg can't snapshot
// directly, so everything is flattened here first.
import { build } from 'esbuild';

await build({
    entryPoints: ['src/server.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: 'dist/server.cjs',
    sourcemap: false,
    logLevel: 'info',
    // youtubei.js reads import.meta.url; give it a CJS equivalent.
    define: { 'import.meta.url': '__import_meta_url' },
    banner: { js: "const __import_meta_url = require('url').pathToFileURL(__filename).href;" },
    // Optional native ws accelerators: `ws` requires them inside try/catch.
    external: ['bufferutil', 'utf-8-validate'],
});
