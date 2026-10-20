import { defineConfig } from '@playwright/test';

/** Live x.com compatibility check — opt-in, never part of the default suite. */
export default defineConfig({
  testDir: 'tests/e2e-real',
  timeout: 120_000,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results-real',
});
