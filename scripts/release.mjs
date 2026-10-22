#!/usr/bin/env node
/**
 * Prepares a release for the Chrome Web Store:
 *   npm run release -- patch|minor|major|1.2.3 [--skip-e2e]
 * 1. bumps the version (package.json → manifest),
 * 2. turns the « Non publié » section of CHANGELOG.md into « <version> — <date> »,
 * 3. runs typecheck, lint, tests, build, validation (+ e2e unless --skip-e2e),
 * 4. writes artifacts/threadshelf-<version>.zip — the file to upload to the store.
 * It never publishes or pushes anything by itself.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const arg = process.argv[2];
const skipE2e = process.argv.includes('--skip-e2e');
if (!arg) {
  console.error('Usage: npm run release -- patch|minor|major|<x.y.z> [--skip-e2e]');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [maj, min, pat] = pkg.version.split('.').map(Number);
const next =
  arg === 'major'
    ? `${maj + 1}.0.0`
    : arg === 'minor'
      ? `${maj}.${min + 1}.0`
      : arg === 'patch'
        ? `${maj}.${min}.${pat + 1}`
        : arg;
if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`Invalid version: ${next}`);
  process.exit(1);
}
const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (status) console.warn('⚠︎ Uncommitted changes — the release will include them.\n');

pkg.version = next;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
lock.version = next;
if (lock.packages?.['']) lock.packages[''].version = next;
writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');

const day = new Date().toISOString().slice(0, 10);
let changelog = readFileSync('CHANGELOG.md', 'utf8');
if (changelog.includes('## Non publié')) {
  changelog = changelog.replace('## Non publié', `## ${next} — ${day}`);
  writeFileSync('CHANGELOG.md', changelog);
} else {
  console.warn('⚠︎ No « ## Non publié » section in CHANGELOG.md.');
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
run('npm run typecheck');
run('npm run lint');
run('npm run test');
run('npm run build');
run('npm run validate');
if (!skipE2e) run('npm run test:e2e');
run('npm run zip');

console.log(`\nThreadShelf ${next} prêt : artifacts/threadshelf-${next}.zip`);
console.log(
  'Étapes suivantes : vérifier, committer (« Release ' +
    next +
    ' »), puis publier sur le Chrome Web Store (docs/DISTRIBUTION.md).',
);
