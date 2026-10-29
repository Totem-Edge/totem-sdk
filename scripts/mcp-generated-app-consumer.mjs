#!/usr/bin/env node
/**
 * Generated-application acceptance for MCP recipes.
 *
 * Generates each maintained recipe, installs its pinned dependencies, builds
 * and executes the generated workflow tests in an isolated temp project.
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
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

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
}

const index = buildIndex();
for (const recipe of RECIPES) {
  const plan = planRecipe(recipe, index);
  const generated = scaffoldApp({ appName: `${recipe.id}-demo`, runtime: 'node-esm', plan }, index);
  const dir = mkdtempSync(join(tmpdir(), `totem-${recipe.id}-`));
  try {
    for (const file of generated.files) {
      const path = join(dir, file.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.content);
    }
    run('pnpm', ['install', '--ignore-scripts', '--config.verify-deps-before-run=false'], dir);
    run('pnpm', ['run', 'build'], dir);
    const output = run('pnpm', ['test'], dir);
    if (!output.includes('# fail 0')) throw new Error(`${recipe.id}: generated tests failed`);
    console.log(`generated app passed: ${recipe.id} (${plan.workflow.steps.length} steps)`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
