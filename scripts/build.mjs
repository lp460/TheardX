#!/usr/bin/env node
/**
 * Builds the unpacked extension into dist/:
 *   1. extension pages (popup, library, reader, options) — Vite multi-page, ES modules
 *   2. background service worker — single ES module
 *   3. content script — single classic IIFE (MV3 content scripts cannot be modules)
 *   4. manifest.json + icons
 */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { createManifest } from '../src/manifest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const watch = process.argv.includes('--watch');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

const shared = {
  configFile: false,
  root: resolve(root, 'src'),
  publicDir: false,
  resolve: { alias: { '@': resolve(root, 'src') } },
  define: {
    'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production'),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  logLevel: 'warn',
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const started = Date.now();

// 1. Pages
await build({
  ...shared,
  base: '/',
  plugins: [react()],
  css: { postcss: resolve(root, 'postcss.config.js') },
  build: {
    outDir: dist,
    emptyOutDir: false,
    target: 'chrome120',
    sourcemap: watch ? 'inline' : false,
    minify: !watch,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 1200,
    watch: watch ? {} : null,
    rollupOptions: {
      input: {
        popup: resolve(root, 'src/popup/index.html'),
        library: resolve(root, 'src/library/index.html'),
        reader: resolve(root, 'src/reader/index.html'),
        options: resolve(root, 'src/options/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});

// 2. Background service worker
await build({
  ...shared,
  build: {
    outDir: dist,
    emptyOutDir: false,
    target: 'chrome120',
    minify: !watch,
    watch: watch ? {} : null,
    lib: {
      entry: resolve(root, 'src/background/index.ts'),
      formats: ['es'],
      fileName: () => 'background.js',
    },
    rollupOptions: { output: { codeSplitting: false } },
  },
});

// 3. Content script (classic script, everything inlined, CSS injected into its Shadow DOM)
await build({
  ...shared,
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        (await import('tailwindcss')).default(resolve(root, 'tailwind.content.config.js')),
        (await import('autoprefixer')).default(),
      ],
    },
  },
  build: {
    outDir: dist,
    emptyOutDir: false,
    target: 'chrome120',
    minify: !watch,
    watch: watch ? {} : null,
    lib: {
      entry: resolve(root, 'src/content/index.ts'),
      formats: ['iife'],
      name: 'ThreadShelfContent',
      fileName: () => 'content.js',
    },
    rollupOptions: { output: { codeSplitting: false } },
  },
});

// 4. Manifest + static assets
await writeFile(
  resolve(dist, 'manifest.json'),
  JSON.stringify(createManifest(pkg), null, 2) + '\n',
);
await cp(resolve(root, 'public'), dist, { recursive: true });

console.log(
  `ThreadShelf ${pkg.version} built in ${Date.now() - started} ms → ${dist}${watch ? ' (watching)' : ''}`,
);
