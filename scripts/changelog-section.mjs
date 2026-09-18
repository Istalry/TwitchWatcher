#!/usr/bin/env node
// Prints the CHANGELOG.md section for one version (used as the GitHub release body).
//   node scripts/changelog-section.mjs 2.0.0
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = (process.argv[2] ?? '').replace(/^v/, '');
if (!version) {
    console.error('usage: changelog-section.mjs <version>');
    process.exit(1);
}

const changelog = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'CHANGELOG.md'), 'utf8');
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const match = changelog.match(new RegExp(`^## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|^\\[[^\\]]+\\]: |$(?![\\s\\S]))`, 'm'));
const body = (match?.[1] ?? '').trim();

process.stdout.write(body ? `${body}\n` : `Release ${version}.\n`);
