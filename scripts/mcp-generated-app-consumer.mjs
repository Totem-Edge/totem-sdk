#!/usr/bin/env node
/**
 * Generated-application acceptance for MCP recipes.
 *
 * Generates each maintained recipe, installs its pinned dependencies, builds
 * and executes the generated workflow tests in an isolated temp project.
 *
 * The scaffolder pins the *workspace* version of every SDK package. During a
 * release train those versions are ahead of npm (the train publishes after the
 * PR merges), so installing by pin would fail on a package that is not on the
 * registry yet. By default this gate therefore installs the workspace build:
 * every SDK package in the app's dependency closure is packed to a tarball and
 * wired in through `pnpm.overrides`, so transitive `workspace:^` ranges (which
 * `pnpm pack` rewrites to the new version) resolve to the same build.
 *
 * `--registry` turns that off and installs the pins from npm, which is the
 * release-qualification shape (`scripts/smoke-release-install.mjs` runs it once
 * the versions exist).
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { buildIndex } = require(join(ROOT, 'packages', 'mcp-server', 'dist', 'indexer.js'));
const { RECIPES, planRecipe } = require(join(ROOT, 'packages', 'mcp-server', 'dist', 'recipes.js'));
const { scaffoldApp } = require(join(ROOT, 'packages', 'mcp-server', 'dist', 'composition.js'));

const USE_REGISTRY = process.argv.includes('--registry');

// `minimum-release-age` (pnpm's supply-chain gate) hides versions published in
// the last day from *range* resolution. The app pins exact SDK versions, so a
// transitive `@totemsdk/core: ^1.4.2` would otherwise install an older copy next
// to the pinned one, and the duplicate core-wasm peer variant never initialises
// its wasm module (`__wbindgen_malloc` is undefined). It has to be passed as a
// config flag on every pnpm command: a project `.npmrc` entry is ignored and
// pnpm re-verifies dependencies before `run`.
const SDK_INSTALL_FLAGS = ['--config.minimum-release-age=0', '--config.verify-deps-before-run=false'];

function run(cmd, args, cwd) {
  const finalArgs = cmd === 'pnpm' ? [...SDK_INSTALL_FLAGS, ...args] : args;
  return execFileSync(cmd, finalArgs, { cwd, stdio: 'pipe', encoding: 'utf8' });
}

/** name → { dir, manifest } for every package in the workspace. */
const WORKSPACE = new Map();
for (const entry of readdirSync(join(ROOT, 'packages'))) {
  const dir = join(ROOT, 'packages', entry);
  const manifestPath = join(dir, 'package.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.name) WORKSPACE.set(manifest.name, { dir, manifest });
}

/** Workspace packages reachable from `names` through workspace dependencies. */
function workspaceClosure(names) {
  const seen = new Set();
  const queue = [...names];
  while (queue.length > 0) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    const entry = WORKSPACE.get(name);
    if (!entry) continue; // third-party: installed from the registry
    seen.add(name);
    for (const dep of Object.keys({ ...entry.manifest.dependencies, ...entry.manifest.peerDependencies })) {
      queue.push(dep);
    }
  }
  return seen;
}

const packDir = mkdtempSync(join(tmpdir(), 'totem-pack-'));
const packed = new Map();
function packWorkspacePackage(name) {
  if (packed.has(name)) return packed.get(name);
  const { dir, manifest } = WORKSPACE.get(name);
  const before = new Set(readdirSync(packDir));
  // `prepare` builds the package; CI already built it, and re-running tsc per
  // package would dominate the gate's runtime.
  run('pnpm', ['pack', '--pack-destination', packDir, '--config.ignore-scripts=true'], dir);
  const tarball = readdirSync(packDir).find((file) => !before.has(file));
  if (!tarball) throw new Error(`pnpm pack produced no tarball for ${name}`);
  const path = join(packDir, tarball);
  packed.set(name, path);
  return path;
}

const index = buildIndex();
try {
  for (const recipe of RECIPES) {
    const plan = planRecipe(recipe, index);
    const generated = scaffoldApp({ appName: `${recipe.id}-demo`, runtime: 'node-esm', plan }, index);
    const overrides = new Map();

    if (!USE_REGISTRY) {
      const appPackage = generated.files.find((file) => file.path === 'package.json');
      const manifest = JSON.parse(appPackage.content);
      for (const name of workspaceClosure(Object.keys(manifest.dependencies))) {
        if (name.startsWith('@totemsdk/')) {
          overrides.set(name, `file:${packWorkspacePackage(name)}`);
        }
      }
      // pnpm 11 moved settings out of `package.json`: `pnpm.overrides` is
      // ignored there, so the app carries a one-line workspace manifest.
      generated.files.push({
        path: 'pnpm-workspace.yaml',
        content: ['overrides:', ...[...overrides].map(([name, target]) => `  '${name}': '${target}'`), ''].join('\n'),
      });
    }

    const dir = mkdtempSync(join(tmpdir(), `totem-${recipe.id}-`));
    try {
      for (const file of generated.files) {
        const path = join(dir, file.path);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, file.content);
      }
      run('pnpm', ['install', '--ignore-scripts'], dir);
      run('pnpm', ['run', 'build'], dir);
      const output = run('pnpm', ['test'], dir);
      if (!output.includes('# fail 0')) throw new Error(`${recipe.id}: generated tests failed`);
      console.log(
        `generated app passed: ${recipe.id} (${plan.workflow.steps.length} steps, ` +
        `${USE_REGISTRY ? 'registry pins' : `${overrides.size} workspace overrides`})`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
} finally {
  rmSync(packDir, { recursive: true, force: true });
}

