import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
    screenshot: 'off',
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
