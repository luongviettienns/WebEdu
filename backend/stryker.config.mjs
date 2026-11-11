/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  vitest: {
    configFile: 'vitest.config.ts',
  },
  mutate: [
    'src/common/auth/role-hierarchy.util.ts',
    'src/common/auth/superadmin-protection.policy.ts',
    'src/common/auth/auth-rate-limit.util.ts',
    'src/common/guards/*.ts',
    'src/modules/auth/services/*.ts',
    'src/modules/system-settings/services/*.ts',
    'src/modules/students/services/*.ts',
    '!**/*.spec.ts',
  ],
  reporters: ['clear-text', 'progress', 'json'],
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },
  thresholds: {
    high: 80,
    low: 60,
    break: null,
  },
  concurrency: 4,
  timeoutMS: 15000,
};
