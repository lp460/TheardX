#!/usr/bin/env node
/** Packs dist/ into artifacts/threadshelf-<version>.zip (uses the system `zip`). */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const m = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
mkdirSync('artifacts', { recursive: true });
const out = resolve(`artifacts/threadshelf-${m.version}.zip`);
rmSync(out, { force: true });
execFileSync('zip', ['-qr', out, '.'], { cwd: 'dist', stdio: 'inherit' });
console.log(out);
