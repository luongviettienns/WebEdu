import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: 'node ../backend/test/scripts/qa-environment.mjs',
      url: 'http://localhost:3001/api/v1/health',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        TEST_DATABASE_URL:
          process.env.TEST_DATABASE_URL ||
          'postgresql://postgres:123456@127.0.0.1:5432/webedu_test?schema=public',
      },
    },
    {
      command: 'npm run start -- --port 3000',
      url: 'http://localhost:3000/login',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NEXT_PUBLIC_API_URL: 'http://localhost:3001/api/v1',
      },
    },
  ],
});
