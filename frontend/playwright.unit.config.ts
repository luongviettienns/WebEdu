import path from 'node:path';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: path.join(__dirname, 'src'),
  testMatch: '**/*.unit.spec.ts',
  fullyParallel: true,
  reporter: [['list']],
});
