#!/usr/bin/env node
/**
 * verify-go.mjs — build/vet/test every standalone Go module under packages.
 *
 * The Go mirrors live in their own modules (`packages/<pkg>/go/go.mod`), are not
 * part of the pnpm workspace, and are not otherwise gated by CI. This script
 * runs `go build`, `go vet` and `go test` per module so they cannot silently rot.
 *
 * Platform notes:
 *  - `packages/edge-can/go` is Linux-only (AF_CAN/raw CAN syscalls) and is
 *    guarded by `//go:build linux`. On non-Linux it is cross-compiled with
 *    GOOS=linux; if that toolchain/GOOS is unavailable it is reported as skipped.
 *  - Modules without test files report "no test files" but still build/vet.
 *
 * Usage:
 *   node scripts/verify-go.mjs            # build + vet + test (default GOOS)
 *   node scripts/verify-go.mjs --build    # build only
 *   node scripts/verify-go.mjs --vet      # build + vet only
 *
 * Exits non-zero if any module fails a requested step.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = join(ROOT, 'packages');

const args = process.argv.slice(2);
const buildOnly = args.includes('--build');
const vetOnly = args.includes('--vet');

// Directories under packages/<pkg>/go that contain a go.mod.
function findGoModules() {
  const dirs = [];
  for (const entry of readdirSync(PACKAGES, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const goDir = join(PACKAGES, entry.name, 'go');
    if (existsSync(join(goDir, 'go.mod'))) dirs.push({ name: entry.name, dir: goDir });
  }
  return dirs.sort((a, b) => a.name.localeCompare(b.name));
}

/** A module is Linux-only if its .go files carry a `//go:build linux` constraint. */
function isLinuxOnly(dir) {
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.go')) continue;
      const head = readFileSync(join(dir, f), 'utf8').split('\n', 5).join('\n');
      if (/\/\/go:build\s+linux/.test(head)) return true;
    }
  } catch { /* ignore */ }
  return false;
}

function run(dir, cmd, cmdArgs, env) {
  try {
    const out = execFileSync(cmd, cmdArgs, {
      cwd: dir,
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env, ...(env ?? {}) },
      timeout: 300_000,
    });
    return { ok: true, out: String(out).trim() };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}`.trim() };
  }
}

function hasGo() {
  const r = run(ROOT, 'go', ['version']);
  return r.ok ? r.out.split('\n')[0] : null;
}

const goVersion = hasGo();
if (!goVersion) {
  console.error('verify-go: `go` not found on PATH. Install Go (e.g. `brew install go`) or skip this gate.');
  process.exit(1);
}
console.log(`verify-go: ${goVersion}\n`);

/** Remove binaries `go build ./...` drops into a module dir (keeps the tree clean). */
function cleanBuildOutputs(dir) {
  try {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      try {
        const st = statSync(p);
        if (st.isFile() && (st.mode & 0o111) && !/\.(go|mod|sum)$/.test(f)) unlinkSync(p);
      } catch { /* ignore */ }
    }
    const cmdDir = join(dir, 'cmd');
    if (existsSync(cmdDir)) {
      for (const c of readdirSync(cmdDir)) {
        const bin = join(cmdDir, c, c);
        if (existsSync(bin)) { try { unlinkSync(bin); } catch { /* ignore */ } }
      }
    }
  } catch { /* ignore */ }
}

const modules = findGoModules();
let failed = 0;

for (const mod of modules) {
  const env = isLinuxOnly(mod.dir) ? { GOOS: 'linux' } : {};
  const label = isLinuxOnly(mod.dir) ? `${mod.name} (GOOS=linux)` : mod.name;

  // `go build ./...` writes a main-package binary into the module dir; clean it up
  // afterwards so the working tree stays free of build artifacts.
  const build = run(mod.dir, 'go', ['build', './...'], env);
  cleanBuildOutputs(mod.dir);
  let vet = { ok: true };
  let test = { ok: true };

  if (build.ok && !buildOnly) {
    vet = run(mod.dir, 'go', ['vet', './...'], env);
  }
  if (build.ok && vet.ok && !buildOnly && !vetOnly) {
    test = run(mod.dir, 'go', ['test', './...'], env);
  }

  const status = !build.ok ? 'FAIL build'
    : !vet.ok ? 'FAIL vet'
      : !test.ok ? 'FAIL test'
        : 'ok';
  if (status.startsWith('FAIL')) failed += 1;
  console.log(`${status.padEnd(10)} ${label}`);
  if (!build.ok) console.log(`  ${build.out.split('\n').slice(0, 6).join('\n  ')}`);
  else if (!vet.ok) console.log(`  ${vet.out.split('\n').slice(0, 6).join('\n  ')}`);
  else if (!test.ok) console.log(`  ${test.out.split('\n').slice(0, 6).join('\n  ')}`);
}

console.log(`\nverify-go: ${modules.length - failed}/${modules.length} modules ok`);
process.exit(failed > 0 ? 1 : 0);
