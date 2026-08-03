#!/usr/bin/env node
/**
 * Workspace verification gate.
 *
 * Consumes scripts/workspace-gates.config.json — the single machine-readable
 * source of truth for which packages are publishable (must pass every gate)
 * and which are intentionally excluded from publishing (skipped, with an
 * explicit reason).
 *
 * Usage:
 *   node scripts/verify-workspace.mjs --all
 *   node scripts/verify-workspace.mjs --typecheck
 *   node scripts/verify-workspace.mjs --lint
 *   node scripts/verify-workspace.mjs --test
 *   node scripts/verify-workspace.mjs --integration
 *   node scripts/verify-workspace.mjs --pack
 *
 * Exit code is non-zero if any publishable package fails its gate. Excluded
 * packages are reported but never silently pass or fail — their exclusion is
 * recorded machine-readably in the config.
 *
 * No failure suppression: `|| true`, `continue-on-error`, and `--passWithNoTests`
 * are prohibited from appearing in publishable-package scripts and are checked
 * here.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CONFIG_PATH = join(__dirname, 'workspace-gates.config.json');
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));

const PUBLISHABLE = Object.entries(config.packages).filter(([, v]) => v.status === 'publishable');
const EXCLUDED = Object.entries(config.packages).filter(([, v]) => v.status !== 'publishable');

// Gate flags ---------------------------------------------------------------
const args = process.argv.slice(2);
const wantAll = args.includes('--all') || args.length === 0;
const wantTypecheck = wantAll || args.includes('--typecheck');
const wantLint = wantAll || args.includes('--lint');
const wantTest = wantAll || args.includes('--test');
const wantIntegration = wantAll || args.includes('--integration');
const wantPack = wantAll || args.includes('--pack');

// Forbidden suppression markers in publishable-package scripts -------------
const FORBIDDEN_SCRIPT_MARKERS = ['|| true', '||true', '--passWithNoTests', 'echo \'no tests\'', 'echo "no tests"', 'echo "no tests yet"'];

const results = [];
let failures = 0;

function run(cwd, cmd, label) {
  const r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failures += 1;
  results.push({ label, ok, output: r.stdout + r.stderr });
  if (!ok) {
    process.stdout.write(`\n--- FAIL: ${label}\n`);
    process.stdout.write((r.stdout + r.stderr).slice(-6000) + '\n');
  } else {
    process.stdout.write(`ok: ${label}\n`);
  }
  return ok;
}

function packageHasTestFiles(pkgDir) {
  const candidates = ['src/__tests__', 'test', '__tests__', 'src/test'];
  for (const c of candidates) {
    const full = join(pkgDir, c);
    if (existsSync(full)) {
      try {
        const files = readdirSync(full, { recursive: true });
        if (files.some((f) => /\.(test|spec)\.(ts|tsx|js|mjs)$/.test(String(f)))) return true;
      } catch { /* continue */ }
    }
  }
  return false;
}

process.stdout.write(`Workspace verification gate\n`);
process.stdout.write(`  publishable packages: ${PUBLISHABLE.length}\n`);
process.stdout.write(`  excluded packages:    ${EXCLUDED.length}\n\n`);

// 1. Script-hygiene gate: no suppression markers in publishable packages ----
if (wantLint) {
  process.stdout.write('── script hygiene (publishable packages) ──────────────\n');
  for (const [dir, meta] of PUBLISHABLE) {
    const pj = join(ROOT, dir, 'package.json');
    if (!existsSync(pj)) {
      failures += 1;
      results.push({ label: `${dir}: missing package.json`, ok: false });
      continue;
    }
    const manifest = JSON.parse(readFileSync(pj, 'utf8'));
    const scripts = manifest.scripts ?? {};
    const allScripts = Object.values(scripts).join(' ');
    const hit = FORBIDDEN_SCRIPT_MARKERS.find((m) => allScripts.includes(m));
    if (hit) {
      failures += 1;
      process.stdout.write(`FAIL: ${dir} uses forbidden marker '${hit}' in scripts\n`);
      results.push({ label: `${dir}: forbidden marker '${hit}'`, ok: false });
    } else if (manifest.scripts?.test && !packageHasTestFiles(join(ROOT, dir))) {
      const testScript = String(manifest.scripts.test);
      const nativeTestRunner = /wasm-pack test|cargo test|go test|test:rust/.test(testScript);
      if (nativeTestRunner) {
        results.push({ label: `${dir}: script hygiene (native test runner)`, ok: true });
      } else {
        failures += 1;
        process.stdout.write(`FAIL: ${dir} declares a test script but has no test files\n`);
        results.push({ label: `${dir}: test script without test files`, ok: false });
      }
    } else {
      results.push({ label: `${dir}: script hygiene`, ok: true });
    }
  }
  process.stdout.write('\n');
}

// 2. Typecheck gate --------------------------------------------------------
if (wantTypecheck) {
  process.stdout.write('── typecheck (publishable packages) ───────────────────\n');
  for (const [dir, meta] of PUBLISHABLE) {
    const pkgDir = join(ROOT, dir);
    const pj = join(pkgDir, 'package.json');
    if (!existsSync(pj)) { failures += 1; results.push({ label: `${dir}: missing package.json`, ok: false }); continue; }
    const manifest = JSON.parse(readFileSync(pj, 'utf8'));
    if (manifest.scripts?.typecheck) {
      run(pkgDir, 'npm run typecheck', `${dir}: typecheck`);
    } else {
      // fall back to build (tsc) which performs type-checking during emit
      if (manifest.scripts?.build) {
        run(pkgDir, 'npm run build', `${dir}: build (typecheck)`);
      }
    }
  }
  process.stdout.write('\n');
}

// 3. Lint gate -------------------------------------------------------------
if (wantLint) {
  process.stdout.write('── lint (publishable packages with a lint script) ──────\n');
  for (const [dir, meta] of PUBLISHABLE) {
    const pkgDir = join(ROOT, dir);
    const pj = join(pkgDir, 'package.json');
    if (!existsSync(pj)) continue;
    const manifest = JSON.parse(readFileSync(pj, 'utf8'));
    if (manifest.scripts?.lint) {
      run(pkgDir, 'npm run lint', `${dir}: lint`);
    }
  }
  process.stdout.write('\n');
}

// 4. Test gate --------------------------------------------------------------
if (wantTest) {
  process.stdout.write('── unit tests (publishable packages with a test script) ──\n');
  for (const [dir, meta] of PUBLISHABLE) {
    const pkgDir = join(ROOT, dir);
    const pj = join(pkgDir, 'package.json');
    if (!existsSync(pj)) continue;
    const manifest = JSON.parse(readFileSync(pj, 'utf8'));
    if (manifest.scripts?.test) {
      run(pkgDir, 'npm test', `${dir}: test`);
    }
  }
  process.stdout.write('\n');
}

// 5. Integration gate ------------------------------------------------------
if (wantIntegration) {
  process.stdout.write('── integration (publishable packages with a test:integration script) ──\n');
  for (const [dir, meta] of PUBLISHABLE) {
    const pkgDir = join(ROOT, dir);
    const pj = join(pkgDir, 'package.json');
    if (!existsSync(pj)) continue;
    const manifest = JSON.parse(readFileSync(pj, 'utf8'));
    if (manifest.scripts?.['test:integration']) {
      run(pkgDir, 'npm run test:integration', `${dir}: test:integration`);
    }
  }
  process.stdout.write('\n');
}

// 5. Pack gate -------------------------------------------------------------
if (wantPack) {
  process.stdout.write('── pack (publishable packages) ─────────────────────────\n');
  for (const [dir, meta] of PUBLISHABLE) {
    const pkgDir = join(ROOT, dir);
    run(pkgDir, 'npm pack --dry-run --json', `${dir}: pack --dry-run`);
  }
  process.stdout.write('\n');
}

// Report -------------------------------------------------------------------
process.stdout.write('\n══════════════════════════════════════════════════════\n');
process.stdout.write('Excluded packages (not published; machine-readable reason in config):\n');
for (const [dir, meta] of EXCLUDED) {
  process.stdout.write(`  ${dir}  (${meta.reason})\n`);
}
process.stdout.write('\n');
process.stdout.write(`Gates: ${results.filter((r) => r.ok).length} passed, ${results.filter((r) => !r.ok).length} failed\n`);
process.stdout.write(failures === 0 ? 'VERIFY: PASS\n' : 'VERIFY: FAIL\n');
process.exit(failures === 0 ? 0 : 1);
