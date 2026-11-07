import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const BACKEND_SERVICE_MAX_LOC = 350;
const FRONTEND_PAGE_MAX_LOC = 250;

function scanDir(dir, filterFn, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, filterFn, acc);
    } else if (entry.isFile() && filterFn(fullPath)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split(/\r?\n/).length;
}

const backendServices = scanDir(
  path.join(ROOT, 'backend', 'src'),
  (p) => p.endsWith('.service.ts') && !p.endsWith('.spec.ts'),
);

const frontendPages = scanDir(
  path.join(ROOT, 'frontend', 'src', 'app'),
  (p) => path.basename(p) === 'page.tsx',
);

let failures = 0;

console.log('--- Anti-God-File LOC Guardrails Check ---\n');

console.log(`Checking Backend Services (limit: ${BACKEND_SERVICE_MAX_LOC} LOC):`);
for (const file of backendServices) {
  const lines = countLines(file);
  const relPath = path.relative(ROOT, file);
  if (lines > BACKEND_SERVICE_MAX_LOC) {
    console.error(`  [FAIL] ${relPath}: ${lines} LOC > ${BACKEND_SERVICE_MAX_LOC} LOC`);
    failures++;
  } else {
    console.log(`  [PASS] ${relPath}: ${lines} LOC`);
  }
}

console.log(`\nChecking Frontend Pages (limit: ${FRONTEND_PAGE_MAX_LOC} LOC):`);
for (const file of frontendPages) {
  const lines = countLines(file);
  const relPath = path.relative(ROOT, file);
  if (lines > FRONTEND_PAGE_MAX_LOC) {
    console.error(`  [FAIL] ${relPath}: ${lines} LOC > ${FRONTEND_PAGE_MAX_LOC} LOC`);
    failures++;
  } else {
    console.log(`  [PASS] ${relPath}: ${lines} LOC`);
  }
}

console.log('\n------------------------------------------');
if (failures > 0) {
  console.error(`\nLOC Guardrail Failed with ${failures} violations.`);
  process.exit(1);
} else {
  console.log(`\nAll ${backendServices.length} backend services and ${frontendPages.length} frontend pages pass LOC guardrails!`);
  process.exit(0);
}
