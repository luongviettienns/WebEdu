#!/usr/bin/env node
/**
 * Guardrail check enforcing WebEdu Anti-God-File & Single-Responsibility LOC limits
 * across backend modules and frontend App Router / feature slices.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const BACKEND_SERVICE_MAX_LOC = 350;
const BACKEND_GUARD_MAX_LOC = 200;
const BACKEND_MODULE_PART_MAX_LOC = 250;
const FRONTEND_PAGE_MAX_LOC = 250;
const FRONTEND_HOOK_MAX_LOC = 300;
const FRONTEND_COMPONENT_MAX_LOC = 300;

const IGNORED_DIRS = new Set(['node_modules', 'dist', '.next', 'coverage', '.git']);

function scanDir(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, predicate, results);
    } else if (entry.isFile()) {
      const normalized = fullPath.split(path.sep).join('/');
      if (predicate(normalized)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function countLines(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (raw.length === 0) return 0;
  return raw.replace(/\r?\n$/, '').split(/\r?\n/).length;
}

const isTestFile = (p) => /\.(spec|test)\.(ts|tsx)$/.test(p);

const checks = [
  {
    label: 'Backend Services',
    maxLoc: BACKEND_SERVICE_MAX_LOC,
    files: scanDir(
      path.join(ROOT, 'backend', 'src'),
      (p) => p.endsWith('.service.ts') && !isTestFile(p),
    ),
  },
  {
    label: 'Backend Guards',
    maxLoc: BACKEND_GUARD_MAX_LOC,
    files: scanDir(
      path.join(ROOT, 'backend', 'src'),
      (p) => p.endsWith('.guard.ts') && !isTestFile(p),
    ),
  },
  {
    label: 'Backend Controllers / Policies / Mappers',
    maxLoc: BACKEND_MODULE_PART_MAX_LOC,
    files: scanDir(
      path.join(ROOT, 'backend', 'src'),
      (p) => /\.(controller|policy|mapper)\.ts$/.test(p) && !isTestFile(p),
    ),
  },
  {
    label: 'Frontend App Pages',
    maxLoc: FRONTEND_PAGE_MAX_LOC,
    files: scanDir(
      path.join(ROOT, 'frontend', 'src', 'app'),
      (p) => path.basename(p) === 'page.tsx',
    ),
  },
  {
    label: 'Frontend Feature Hooks',
    maxLoc: FRONTEND_HOOK_MAX_LOC,
    files: scanDir(
      path.join(ROOT, 'frontend', 'src', 'features'),
      (p) => /\/hooks\/[^/]+\.ts$/.test(p) && !isTestFile(p),
    ),
  },
  {
    label: 'Frontend Feature Components',
    maxLoc: FRONTEND_COMPONENT_MAX_LOC,
    files: scanDir(
      path.join(ROOT, 'frontend', 'src', 'features'),
      (p) => /\/components\/[^/]+\.tsx$/.test(p) && !isTestFile(p),
    ),
  },
];

const violations = [];
let totalFilesChecked = 0;

for (const group of checks) {
  totalFilesChecked += group.files.length;
  for (const filePath of group.files) {
    const loc = countLines(filePath);
    if (loc > group.maxLoc) {
      violations.push({
        label: group.label,
        file: path.relative(ROOT, filePath).split(path.sep).join('/'),
        loc,
        maxLoc: group.maxLoc,
      });
    }
  }
}

if (violations.length > 0) {
  console.error('LOC check failed. The following files exceed the allowed limit:');
  for (const v of violations) {
    console.error(`  - [${v.label}] ${v.file}: ${v.loc} LOC (max ${v.maxLoc})`);
  }
  process.exit(1);
}

console.log(
  `LOC check passed (${totalFilesChecked} files checked across ${checks.length} categories).`,
);
