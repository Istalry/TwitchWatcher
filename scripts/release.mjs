#!/usr/bin/env node
/**
 * Cuts a release locally: bumps the version, rolls CHANGELOG.md, commits and tags.
 * Never pushes — run the printed `git push` yourself.
 *
 *   npm run release -- patch | minor | major | 2.1.0 | 2.1.0-beta.1
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_PKG = join(ROOT, 'server', 'package.json');
const ROOT_PKG = join(ROOT, 'package.json');
const CHANGELOG = join(ROOT, 'CHANGELOG.md');
const REPO_URL = 'https://github.com/Istalry/TwitchWatcher';

const sh = (cmd) => execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
const fail = (msg) => {
    console.error(`\nrelease: ${msg}`);
    process.exit(1);
};

const arg = process.argv[2];
if (!arg) fail('usage: npm run release -- <patch|minor|major|x.y.z[-pre]>');

// --- Preconditions ---------------------------------------------------------
if (sh('git status --porcelain')) fail('working tree is not clean; commit or stash first.');
const branch = sh('git rev-parse --abbrev-ref HEAD');
if (branch !== 'main') fail(`must be on main (currently on ${branch}).`);

// --- Version ---------------------------------------------------------------
const serverPkg = JSON.parse(readFileSync(SERVER_PKG, 'utf8'));
const current = serverPkg.version;
const [curCore] = current.split('-');
const [maj, min, pat] = curCore.split('.').map(Number);

let next;
if (arg === 'major') next = `${maj + 1}.0.0`;
else if (arg === 'minor') next = `${maj}.${min + 1}.0`;
else if (arg === 'patch') next = `${maj}.${min}.${pat + 1}`;
else if (/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(arg)) next = arg;
else fail(`unrecognised version "${arg}".`);

const tag = `v${next}`;
if (sh(`git tag --list ${tag}`)) fail(`tag ${tag} already exists.`);

const bump = (file) => {
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    pkg.version = next;
    writeFileSync(file, JSON.stringify(pkg, null, file === SERVER_PKG ? 4 : 2) + '\n');
};

// --- Changelog -------------------------------------------------------------
let changelog = readFileSync(CHANGELOG, 'utf8');
const today = new Date().toISOString().slice(0, 10);
const hasSection = new RegExp(`^## \\[${next.replace(/\./g, '\\.')}\\]`, 'm').test(changelog);

if (!hasSection) {
    const m = changelog.match(/^## \[Unreleased\]\s*\n([\s\S]*?)(?=^## \[|\[Unreleased\]:|$(?![\s\S]))/m);
    const unreleased = (m?.[1] ?? '').trim();
    if (!unreleased) fail('the [Unreleased] section of CHANGELOG.md is empty; write the notes first.');

    changelog = changelog.replace(m[0], `## [Unreleased]\n\n## [${next}] - ${today}\n\n${unreleased}\n\n`);
    // Link references at the bottom.
    changelog = changelog.replace(
        /^\[Unreleased\]: .*$/m,
        `[Unreleased]: ${REPO_URL}/compare/${tag}...HEAD\n[${next}]: ${REPO_URL}/compare/v${current}...${tag}`,
    );
    writeFileSync(CHANGELOG, changelog);
    console.log(`CHANGELOG.md: moved [Unreleased] under [${next}] - ${today}`);
} else {
    console.log(`CHANGELOG.md: section [${next}] already present, left untouched`);
}

// --- Commit + tag ----------------------------------------------------------
if (current !== next) {
    bump(SERVER_PKG);
    bump(ROOT_PKG);
    console.log(`version: ${current} -> ${next}`);
} else {
    console.log(`version: already ${next}`);
}

if (sh('git status --porcelain')) {
    sh('git add CHANGELOG.md package.json server/package.json');
    sh(`git commit -q -m "chore(release): ${tag}"`);
    console.log(`committed chore(release): ${tag}`);
}
sh(`git tag -a ${tag} -m "${tag}"`);
console.log(`tagged ${tag}`);

console.log(`\nNext step (not done for you):\n\n    git push origin main --follow-tags\n\nThe release workflow then builds the exe and publishes ${tag} on GitHub.`);
