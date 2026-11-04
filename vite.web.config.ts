import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  root: 'web',
  publicDir: '../public',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    outDir: '../dist-web',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./web/index.html', import.meta.url)),
        reader: fileURLToPath(new URL('./web/reader/index.html', import.meta.url)),
        share: fileURLToPath(new URL('./web/share/index.html', import.meta.url)),
      },
    },
  },
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
