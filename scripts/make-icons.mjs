#!/usr/bin/env node
/** Renders public/icons/icon-*.png from the ThreadShelf SVG mark with Playwright's Chromium. */
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = (
  size,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b7bff"/><stop offset="1" stop-color="#5b47e0"/></linearGradient></defs>
<rect x="1" y="1" width="30" height="30" rx="8.5" fill="url(#g)"/>
<rect x="8" y="8" width="16" height="3.2" rx="1.6" fill="#fff"/>
<rect x="8" y="13.6" width="12" height="3.2" rx="1.6" fill="#fff" opacity="0.85"/>
<rect x="8" y="19.2" width="8" height="3.2" rx="1.6" fill="#fff" opacity="0.7"/>
<rect x="6" y="24.4" width="20" height="1.6" rx="0.8" fill="#fff" opacity="0.55"/></svg>`;

await mkdir('public/icons', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg(size)}</body></html>`,
  );
  await page
    .locator('svg')
    .screenshot({ path: `public/icons/icon-${size}.png`, omitBackground: true });
}
await browser.close();
console.log('icons written to public/icons');
