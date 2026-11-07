import { defineConfig } from 'vitest/config';
import e2eConfig from './vitest.config.e2e.js';

export default defineConfig({
  ...e2eConfig,
  test: {
    ...e2eConfig.test,
    env: { DATABASE_URL: '', TEST_DATABASE_URL: '' },
    include: ['test/rbac-phase3.audit-spec.ts'],
  },
});
