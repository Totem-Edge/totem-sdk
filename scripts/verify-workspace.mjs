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
 *   node scripts/verify-workspace.mjs --conformance
 *   node scripts/verify-workspace.mjs --recovery
 *   node scripts/verify-workspace.mjs --consumer
 *   node scripts/verify-workspace.mjs --maturity <level>  # Run required gates for packages at this exact level
 *
 * Exit code is non-zero if any publishable package fails its gate. Excluded
 * packages are reported but never silently pass or fail — their exclusion is
 * recorded machine-readably in the config.
 *
 * No failure suppression: `|| true`, `continue-on-error`, and `--passWithNoTests`
 * are prohibited from appearing in publishable-package scripts and are checked
 * here.
 *
 * Maturity levels (schemaVersion 2):
 *   alpha → beta → rc → v1
 *   Each level activates additional required gates via maturityGates config.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CONFIG_PATH = join(__dirname, 'workspace-gates.config.json');
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));

// Discover every package manifest under the declared workspace globs so an
// omitted package can never fall outside the verification system.
function discoverWorkspaceDirs() {
  const found = new Set();
  for (const glob of config.workspaceGlobs ?? ['packages/*', 'extensions/*']) {
    const [base, _rest] = glob.split('/');
    const baseDir = join(ROOT, base);
    if (!existsSync(baseDir)) continue;
    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = `${base}/${entry.name}`;
      const pj = join(ROOT, dir, 'package.json');
      if (existsSync(pj)) found.add(dir);
    }
  }
  return found;
}

const DISCOVERED_DIRS = discoverWorkspaceDirs();
const CONFIGURED_DIRS = new Set(Object.keys(config.packages));
const UNCLASSIFIED = [...DISCOVERED_DIRS].sort().filter((d) => !CONFIGURED_DIRS.has(d));
const STALE_CONFIG = [...CONFIGURED_DIRS].sort().filter((d) => !DISCOVERED_DIRS.has(d));

const PUBLISHABLE = Object.entries(config.packages).filter(([, v]) => v.status === 'publishable');
const EXCLUDED = Object.entries(config.packages).filter(([, v]) => v.status !== 'publishable');
const PUBLISHABLE_DIRS = new Set(PUBLISHABLE.map(([dir]) => dir));
const WORKSPACE_DIRS = new Set([...DISCOVERED_DIRS, ...CONFIGURED_DIRS]);

// Gate flags ---------------------------------------------------------------
const args = process.argv.slice(2);
const gateFlags = ['--typecheck', '--lint', '--test', '--integration', '--pack', '--conformance', '--recovery', '--consumer'];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--maturity') {
    if (i !== args.indexOf('--maturity')) {
      console.error('FAIL: --maturity may only be specified once');
      process.exit(2);
    }
    i++;
  } else if (args[i] !== '--all' && !gateFlags.includes(args[i])) {
    console.error(`FAIL: unknown argument '${args[i]}'`);
    process.exit(2);
  }
}
// A selector alone activates its required gates; it is never a no-op.
const wantAll = args.includes('--all') || !gateFlags.some((flag) => args.includes(flag));
const wantTypecheck = wantAll || args.includes('--typecheck');
const wantLint = wantAll || args.includes('--lint');
const wantTest = wantAll || args.includes('--test');
const wantIntegration = wantAll || args.includes('--integration');
const wantPack = wantAll || args.includes('--pack');
const wantConformance = wantAll || args.includes('--conformance');
const wantRecovery = wantAll || args.includes('--recovery');
const wantConsumer = wantAll || args.includes('--consumer');
const maturityIndex = args.indexOf('--maturity');
const maturityLevel = maturityIndex >= 0 ? args[maturityIndex + 1] : null;

// Forbidden suppression markers in publishable-package scripts -------------
const FORBIDDEN_SCRIPT_MARKERS = ['|| true', '||true', '--passWithNoTests', 'echo \'no tests\'', 'echo "no tests"', 'echo "no tests yet"'];

// Maturity gate checking ----------------------------------------------------
const MATURITY_GATES = config.maturityGates ?? {
  alpha: ['typecheck', 'lint', 'test'],
  beta: ['typecheck', 'lint', 'test', 'pack'],
  rc: ['typecheck', 'lint', 'test', 'pack', 'integration'],
  v1: ['typecheck', 'lint', 'test', 'pack', 'integration', 'conformance', 'recovery', 'consumer'],
};

if (maturityIndex >= 0 && !Object.hasOwn(MATURITY_GATES, maturityLevel)) {
  console.error(`FAIL: invalid maturity level '${String(maturityLevel)}' (expected ${Object.keys(MATURITY_GATES).join(', ')})`);
  process.exit(2);
}

const enabledGates = new Set([
  ...(wantTypecheck ? ['typecheck'] : []),
  ...(wantLint ? ['lint'] : []),
  ...(wantTest ? ['test'] : []),
  ...(wantIntegration ? ['integration'] : []),
  ...(wantPack ? ['pack'] : []),
  ...(wantConformance ? ['conformance'] : []),
  ...(wantRecovery ? ['recovery'] : []),
  ...(wantConsumer ? ['consumer'] : []),
]);
const sharedLintConfigured = Object.hasOwn(config.lint ?? {}, 'sharedRunner');
const sharedLintRunner = typeof config.lint?.sharedRunner === 'string' && config.lint.sharedRunner.trim()
  ? resolve(ROOT, config.lint.sharedRunner) : null;
const sharedLintAvailable = sharedLintRunner !== null && existsSync(sharedLintRunner);

function isGateRequiredForMaturity(gateName, maturity) {
  const requiredGates = MATURITY_GATES[maturity] ?? MATURITY_GATES.alpha;
  return requiredGates.includes(gateName);
}

function shouldRunGate(gateName, pkgMaturity) {
  // If maturity filtering is enabled, only run gates required for that level
  if (maturityLevel) {
    return isGateRequiredForMaturity(gateName, maturityLevel);
  }
  // If package has a maturity level, check if gate is required for it
  if (pkgMaturity) {
    return isGateRequiredForMaturity(gateName, pkgMaturity);
  }
  // Default: run all gates
  return true;
}

const results = [];
let failures = 0;
let prerequisiteBuildsDone = false;

function run(cwd, cmd, label, evidence = true, showOutput = false) {
  const r = Array.isArray(cmd)
    ? spawnSync(cmd[0], cmd.slice(1), { cwd, encoding: 'utf8' })
    : spawnSync(cmd, { cwd, shell: true, encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failures += 1;
  results.push({ label, ok, evidence, output: r.stdout + r.stderr });
  if (!ok) {
    process.stdout.write(`\n--- FAIL: ${label}\n`);
    process.stdout.write((r.stdout + r.stderr).slice(-6000) + '\n');
  } else {
    process.stdout.write(`ok: ${label}\n`);
    if (showOutput) process.stdout.write(r.stdout + r.stderr);
  }
  return ok;
}

function readPackageManifest(dir) {
  const pj = join(ROOT, dir, 'package.json');
  if (!existsSync(pj)) return null;
  return JSON.parse(readFileSync(pj, 'utf8'));
}

function getWorkspaceOrder() {
  const nameToDir = new Map();
  const manifests = new Map();

  for (const dir of WORKSPACE_DIRS) {
    const manifest = readPackageManifest(dir);
    if (!manifest?.name) continue;
    manifests.set(dir, manifest);
    nameToDir.set(manifest.name, dir);
  }

  const visiting = new Set();
  const visited = new Set();
  const ordered = [];

  function visit(dir, stack = []) {
    if (visited.has(dir)) return;
    if (visiting.has(dir)) {
      failures += 1;
      const cycle = [...stack, dir].join(' -> ');
      results.push({ label: `workspace dependency cycle: ${cycle}`, ok: false });
      return;
    }

    visiting.add(dir);
    const manifest = manifests.get(dir);
    const depGroups = [
      manifest?.dependencies,
      manifest?.devDependencies,
      manifest?.peerDependencies,
      manifest?.optionalDependencies,
    ];

    for (const deps of depGroups) {
      for (const name of Object.keys(deps ?? {})) {
        const depDir = nameToDir.get(name);
        if (depDir && depDir !== dir && WORKSPACE_DIRS.has(depDir)) {
          visit(depDir, [...stack, dir]);
        }
      }
    }

    visiting.delete(dir);
    visited.add(dir);
    ordered.push([dir, config.packages[dir]]);
  }

  for (const [dir] of PUBLISHABLE) visit(dir);
  return ordered;
}

const ORDERED_WORKSPACE = getWorkspaceOrder();
const ORDERED_PUBLISHABLE = ORDERED_WORKSPACE.filter(([dir]) => PUBLISHABLE_DIRS.has(dir));
const SELECTED_PUBLISHABLE = maturityLevel
  ? ORDERED_PUBLISHABLE.filter(([, meta]) => meta.maturity === maturityLevel)
  : ORDERED_PUBLISHABLE;

// Build only selected packages and their workspace dependency closure.
const BUILD_DIRS = new Set();
const NAME_TO_DIR = new Map([...WORKSPACE_DIRS].map((dir) => [readPackageManifest(dir)?.name, dir]));
function collectBuildDependencies(dir) {
  if (BUILD_DIRS.has(dir)) return;
  BUILD_DIRS.add(dir);
  const manifest = readPackageManifest(dir);
  for (const deps of [manifest?.dependencies, manifest?.devDependencies, manifest?.peerDependencies, manifest?.optionalDependencies]) {
    for (const name of Object.keys(deps ?? {})) {
      const dependency = NAME_TO_DIR.get(name);
      if (dependency) collectBuildDependencies(dependency);
    }
  }
}
for (const [dir] of SELECTED_PUBLISHABLE) collectBuildDependencies(dir);
const SELECTED_DIRS = new Set(SELECTED_PUBLISHABLE.map(([dir]) => dir));

function runBuildGate(labelPrefix, evidence = false) {
  process.stdout.write(`── ${labelPrefix} build prerequisites (dependency order) ──\n`);
  for (const [dir] of ORDERED_WORKSPACE) {
    if (!BUILD_DIRS.has(dir)) continue;
    const pkgDir = join(ROOT, dir);
    const manifest = readPackageManifest(dir);
    if (!manifest) { failures += 1; results.push({ label: `${dir}: missing package.json`, ok: false }); continue; }
    if (manifest.scripts?.build) {
      run(pkgDir, 'npm run build', `${dir}: build`, evidence && SELECTED_DIRS.has(dir));
    }
  }
  process.stdout.write('\n');
}

function ensurePrerequisiteBuilds(labelPrefix) {
  if (prerequisiteBuildsDone) return;
  // Callers that have already built prerequisites (and applied any native
  // post-build steps, e.g. `pnpm rebuild better-sqlite3`) can set this to skip
  // an in-gate rebuild that would otherwise discard those native artifacts.
  if (process.env.SKIP_PREREQUISITE_BUILD === '1') {
    prerequisiteBuildsDone = true;
    return;
  }
  runBuildGate(labelPrefix);
  prerequisiteBuildsDone = true;
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
if (maturityLevel) process.stdout.write(`  selected for ${maturityLevel}: ${SELECTED_PUBLISHABLE.length}\n`);
process.stdout.write(`  excluded packages:    ${EXCLUDED.length}\n`);
process.stdout.write(`  discovered packages:  ${DISCOVERED_DIRS.size}\n\n`);

// 0. Catalog-completeness gate: every discovered workspace package must have a
// machine-readable classification, and every configured entry must exist.
if (UNCLASSIFIED.length > 0) {
  failures += 1;
  process.stdout.write(`FAIL: discovered packages missing from ${CONFIG_PATH}:\n`);
  for (const dir of UNCLASSIFIED) {
    process.stdout.write(`  ${dir}\n`);
    results.push({ label: `${dir}: unclassified package`, ok: false });
  }
  process.stdout.write('\n');
}
if (STALE_CONFIG.length > 0) {
  failures += 1;
  process.stdout.write(`FAIL: configured entries with no package manifest on disk:\n`);
  for (const dir of STALE_CONFIG) {
    process.stdout.write(`  ${dir}\n`);
    results.push({ label: `${dir}: stale config entry`, ok: false });
  }
  process.stdout.write('\n');
}

// 0b. Fail-closed evidence: every selected package must declare the scripts
// required by its maturity. A missing gate is a failure, not a silent skip.
// A package may declare an owned/reasoned notApplicable entry in workspace-gates.config.
if (SELECTED_PUBLISHABLE.length === 0) {
  failures += 1;
  results.push({ label: 'maturity selection: no packages selected', ok: false });
  process.stdout.write(`FAIL: no publishable packages selected for maturity '${String(maturityLevel)}'\n`);
}

const GATE_SCRIPTS = {
  typecheck: 'build',
  lint: 'lint',
  test: 'test',
  integration: 'test:integration',
  conformance: 'test:conformance',
  recovery: 'test:recovery',
  consumer: 'test:consumer',
};
for (const [dir, meta] of SELECTED_PUBLISHABLE) {
  const manifest = readPackageManifest(dir);
  if (!manifest) continue;
  if (!Object.hasOwn(MATURITY_GATES, meta.maturity)) {
    failures += 1;
    results.push({ label: `${dir}: invalid maturity '${meta.maturity}'`, ok: false });
    continue;
  }
  const required = MATURITY_GATES[meta.maturity];
  for (const gate of required) {
    if (!gateFlags.includes(`--${gate}`)) {
      failures += 1;
      results.push({ label: `${dir}: unsupported required gate '${gate}'`, ok: false });
      process.stdout.write(`FAIL: ${dir}: unsupported required gate '${gate}'\n`);
      continue;
    }
    if (!enabledGates.has(gate)) continue;
    if (gate === 'consumer') continue;
    if (gate === 'lint' && sharedLintConfigured) {
      if (!sharedLintAvailable) {
        failures += 1;
        results.push({ label: `${dir}: configured shared lint runner unavailable`, ok: false });
        process.stdout.write(`FAIL: ${dir}: configured shared lint runner unavailable\n`);
      }
      // A local script or N/A must never replace configured shared lint.
      continue;
    }
    const script = GATE_SCRIPTS[gate];
    if (!script) continue;
    if (manifest.scripts?.[script]) continue;
    const exemption = meta.notApplicable?.[gate];
    if (typeof exemption?.owner === 'string' && exemption.owner.trim() &&
        typeof exemption?.reason === 'string' && exemption.reason.trim()) {
      results.push({ label: `${dir}: ${gate} not applicable (${exemption.owner}: ${exemption.reason})`, skipped: true });
      process.stdout.write(`N/A: ${dir}: ${gate} (${exemption.owner}: ${exemption.reason})\n`);
      continue;
    }
    failures += 1;
    results.push({ label: `${dir}: missing required ${script} script for ${meta.maturity}`, ok: false });
    process.stdout.write(`FAIL: ${dir}: missing required ${script} script for ${meta.maturity} gate '${gate}'\n`);
  }
}

// 1. Script hygiene is required for test/qualification invocations as well as lint.
// A direct recovery/conformance invocation must not bypass suppression checks.
if (wantLint || wantTest || wantIntegration || wantConformance || wantRecovery || wantConsumer) {
  process.stdout.write('── script hygiene (publishable packages) ──────────────\n');
  for (const [dir, meta] of SELECTED_PUBLISHABLE) {
    if (!shouldRunGate('lint', meta.maturity)) continue;
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
  // Most packages expose built dist files through package exports. Build in
  // dependency order so each package can resolve local workspace siblings.
  runBuildGate('typecheck', true);
  prerequisiteBuildsDone = true;
}

// 3. Lint gate -------------------------------------------------------------
if (wantLint) {
  process.stdout.write('── lint (mandatory shared rules + package-specific scripts) ──────\n');
  for (const [dir, meta] of SELECTED_PUBLISHABLE) {
    if (!shouldRunGate('lint', meta.maturity)) continue;
    const pkgDir = join(ROOT, dir);
    const pj = join(pkgDir, 'package.json');
    if (!existsSync(pj)) continue;
    const manifest = JSON.parse(readFileSync(pj, 'utf8'));
    if (sharedLintConfigured && sharedLintAvailable) {
      run(ROOT, [process.execPath, sharedLintRunner, pkgDir], `${dir}: shared lint`, true, true);
    }
    if (manifest.scripts?.lint) {
      run(pkgDir, 'npm run lint', `${dir}: lint`);
    }
  }
  process.stdout.write('\n');
}

// 4. Test gate --------------------------------------------------------------
if (wantTest) {
  ensurePrerequisiteBuilds('test');
  process.stdout.write('── unit tests (publishable packages with a test script) ──\n');
  for (const [dir, meta] of SELECTED_PUBLISHABLE) {
    if (!shouldRunGate('test', meta.maturity)) continue;
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

// 5. Pack gate -------------------------------------------------------------
if (wantPack) {
  ensurePrerequisiteBuilds('pack');
  process.stdout.write('── pack (publishable packages) ─────────────────────────\n');
  for (const [dir, meta] of SELECTED_PUBLISHABLE) {
    if (!shouldRunGate('pack', meta.maturity)) continue;
    const pkgDir = join(ROOT, dir);
    run(pkgDir, 'npm pack --dry-run --json', `${dir}: pack --dry-run`);
  }
  process.stdout.write('\n');
}

// 6. Integration and v1-only qualification. Shared consumer installation complements the
// package-owned API/type exercise; conformance and recovery require dedicated suites.
for (const gate of ['integration', 'conformance', 'recovery', 'consumer']) {
  if (!enabledGates.has(gate)) continue;
  const script = GATE_SCRIPTS[gate];
  const runnable = SELECTED_PUBLISHABLE.filter(([dir, meta]) =>
    shouldRunGate(gate, meta.maturity) &&
    (gate === 'consumer' || readPackageManifest(dir)?.scripts?.[script]));
  if (runnable.length === 0) continue;
  ensurePrerequisiteBuilds(gate);
  process.stdout.write(`── ${gate} (package-owned qualification evidence) ──────\n`);
  for (const [dir] of runnable) {
    if (gate === 'consumer') {
      run(ROOT, [process.execPath, join(__dirname, 'verify-consumer-pack.mjs'), join(ROOT, dir)], `${dir}: packed consumer`);
    }
    if (readPackageManifest(dir)?.scripts?.[script]) {
      run(join(ROOT, dir), `npm run ${script}`, `${dir}: ${script}`);
    }
  }
}

// Report -------------------------------------------------------------------
if (!results.some((result) => result.evidence)) {
  failures += 1;
  results.push({ label: 'no selected gate commands executed', ok: false });
  process.stdout.write('FAIL: no selected gate commands executed (hygiene, prerequisites and N/A are not gate execution)\n');
}
process.stdout.write('\n══════════════════════════════════════════════════════\n');
process.stdout.write('Excluded packages (not published; machine-readable reason in config):\n');
for (const [dir, meta] of EXCLUDED) {
  process.stdout.write(`  ${dir}  (${meta.reason})\n`);
}
process.stdout.write('\n');
if (maturityLevel) {
  process.stdout.write(`Maturity filter: ${maturityLevel}\n`);
  process.stdout.write(`  Gates required: ${(MATURITY_GATES[maturityLevel] ?? []).join(', ')}\n\n`);
}
process.stdout.write(`Gates: ${results.filter((r) => r.ok).length} passed, ${results.filter((r) => r.ok === false).length} failed, ${results.filter((r) => r.skipped).length} N/A, ${SELECTED_PUBLISHABLE.length} selected\n`);
process.stdout.write(`Selected gate commands executed: ${results.filter((r) => r.evidence).length}\n`);
process.stdout.write(failures === 0 ? 'VERIFY: PASS\n' : 'VERIFY: FAIL\n');
process.exit(failures === 0 ? 0 : 1);
