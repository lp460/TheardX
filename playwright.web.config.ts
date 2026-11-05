import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e-web',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  // Browser runners default to English; the UI assertions below intentionally
  // exercise French, while dedicated tests switch to English and Spanish.
  use: { baseURL: 'http://127.0.0.1:4173', serviceWorkers: 'allow', locale: 'fr-FR' },
  webServer: {
    command: 'npm run preview:web',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
