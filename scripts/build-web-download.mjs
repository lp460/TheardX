#!/usr/bin/env node
/** Publish a matching, unpackable MV3 extension ZIP alongside the web app.
 * The ZIP is downloadable, not silently installed; Chromium requires developer mode.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/zip.mjs'], { stdio: 'inherit' });
mkdirSync('dist-web/downloads', { recursive: true });
copyFileSync(resolve(`artifacts/threadshelf-${pkg.version}.zip`), resolve('dist-web/downloads/threadshelf-extension.zip'));
