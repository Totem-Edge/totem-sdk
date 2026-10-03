#!/usr/bin/env node
/**
 * RFC-031 P3 — Bun readiness smoke.
 *
 * Imports every publishable package's built entry under Bun and fails on any
 * load error. Bun is Node-compatible, so this should be ~free; it guards against
 * regressions (e.g. a wasm resolution change) that break Bun.
 *
 * Run with Bun:  bun scripts/verify-bun-load.mjs
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

// Packages whose entry self-starts (e.g. a stdio server) are skipped: importing
// them is a side effect, not a load check.
const SKIP = new Set(['@totemsdk/mcp-server', 'mcp-server']);

const targets = [];
for (const name of readdirSync(join(root, 'packages'))) {
  if (SKIP.has(name)) continue;
  const entry = join(root, 'packages', name, 'dist', 'index.js');
  if (existsSync(entry)) targets.push({ name, entry });
}

let failed = 0;
for (const { name, entry } of targets) {
  try {
    await import(pathToFileURL(entry).href);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}: ${(err?.message ?? String(err)).split('\n')[0]}`);
  }
}

console.log(`Bun load smoke: ${targets.length - failed}/${targets.length} packages loaded`);
if (failed > 0) process.exit(1);
