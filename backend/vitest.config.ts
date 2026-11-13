import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['src/**/*.spec.ts'],
    setupFiles: ['reflect-metadata'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.module.ts',
        'src/main.ts',
        'src/**/*.dto.ts',
        'src/**/*.types.ts',
        'src/**/*.constants.ts',
        'src/**/*.decorator.ts',
        'src/modules/auth/auth.controller.ts',
        'src/modules/users/profile.controller.ts',
        'src/modules/students/students.controller.ts',
        'src/modules/teachers/teachers.controller.ts',
        'src/modules/system-settings/system-settings.controller.ts',
      ],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 85,
        statements: 85,
      },
    },
  },
});
