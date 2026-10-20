#!/usr/bin/env node
/**
 * Legacy-surface guard (COMPATIBILITY.md).
 *
 * Fails when a new compatibility shim is added to publishable packages or
 * extension source. Existing debt is recorded in
 * `scripts/legacy-surface-baseline.json`; the guard is intentionally
 * baseline-aware so cleanup can land incrementally.
 *
 * Usage:
 *   node scripts/check-legacy-surface.mjs           # check
 *   node scripts/check-legacy-surface.mjs --update  # refresh the baseline
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts/legacy-surface-baseline.json');
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'scripts/workspace-gates.config.json'), 'utf8'));
const UPDATE = process.argv.includes('--update');

const PUBLISHABLE = Object.entries(CONFIG.packages)
  .filter(([, meta]) => meta.status === 'publishable')
  .map(([dir]) => dir);

const SOURCE_ROOTS = [
  ...PUBLISHABLE.map((dir) => join(ROOT, dir, 'src')),
  ...readdirSync(join(ROOT, 'extensions'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(ROOT, 'extensions', entry.name, 'src'))
    .filter((dir) => existsSync(dir)),
];

const SOURCE_EXT = /\.(ts|tsx|js|mjs|cjs)$/;
const SKIP = /(^|\/)(node_modules|dist|coverage|__tests__|tests?)(\/|$)|\.(test|spec)\./;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full);
    if (SKIP.test(rel)) continue;
    if (entry.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry.name)) out.push(full);
  }
  return out;
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

function packageExportSubpaths(pkg) {
  const found = [];
  function visit(node) {
    if (typeof node === 'string') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('./')) found.push(key);
      visit(value);
    }
  }
  visit(pkg.exports);
  return found;
}

const found = new Map();

function add(file, kind, match) {
  const rel = relative(ROOT, file);
  const key = `${rel}|${kind}|${match}`;
  if (!found.has(key)) found.set(key, { file: rel, kind, match });
}

for (const dir of PUBLISHABLE) {
  const pkgPath = join(ROOT, dir, 'package.json');
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  for (const subpath of packageExportSubpaths(pkg)) {
    if (/(legacy|compat|backward)/i.test(subpath)) add(pkgPath, 'export-subpath', subpath);
  }
}

const EXPORT_DECL = /\bexport\s+(?:declare\s+)?(?:const|let|var|function|class|type|interface|enum)\s+((?:legacy|compat|backward)[A-Za-z0-9_]*)/i;
const EXPORT_LIST = /\bexport\s*(?:type\s*)?\{([^}]*)\}/;
const FLAG = /\b(initMode|fallbackOnError|legacyMode|SdkInitMode|allowLegacy[A-Za-z0-9_]*)\b/;
const UNSAFE_DEFAULT = /\brequireSignedCommands\s*:\s*false\b/;

for (const file of SOURCE_ROOTS.flatMap((dir) => walk(dir))) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (const line of lines) {
    if (/@deprecated\b/.test(line)) add(file, 'deprecated', line.trim());
    if (isCommentLine(line)) continue;

    const decl = EXPORT_DECL.exec(line);
    if (decl) add(file, 'export', decl[1]);

    const list = EXPORT_LIST.exec(line);
    if (list) {
      for (const part of list[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name && /^(legacy|compat|backward)/i.test(name)) add(file, 'export', name);
      }
    }

    const flag = FLAG.exec(line);
    if (flag) add(file, 'flag', flag[1]);

    const unsafe = UNSAFE_DEFAULT.exec(line);
    if (unsafe) add(file, 'unsafe-default', 'requireSignedCommands: false');
  }
}

const current = [...found.values()].sort((a, b) => {
  const ka = `${a.file}|${a.kind}|${a.match}`;
  const kb = `${b.file}|${b.kind}|${b.match}`;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
});

function keyOf(entry) {
  return `${entry.file}|${entry.kind}|${entry.match}`;
}

if (UPDATE) {
  const previous = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, 'utf8')).entries ?? []
    : [];
  const previousByKey = new Map(previous.map((entry) => [keyOf(entry), entry]));
  const entries = current.map((entry) => {
    const old = previousByKey.get(keyOf(entry));
    return {
      ...entry,
      class: old?.class ?? 'unclassified',
      reason: old?.reason ?? 'pre-existing; classify during cleanup',
    };
  });
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note: 'Existing legacy/compat surface. New entries fail scripts/check-legacy-surface.mjs. Remove entries as cleanup lands.',
        entries,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Legacy surface baseline updated: ${entries.length} entries`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error('✗ legacy-surface-baseline.json missing — run: node scripts/check-legacy-surface.mjs --update');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).entries ?? [];
const baselineKeys = new Set(baseline.map(keyOf));
const currentKeys = new Set(current.map(keyOf));
const added = current.filter((entry) => !baselineKeys.has(keyOf(entry)));
const removed = baseline.filter((entry) => !currentKeys.has(keyOf(entry)));

if (removed.length > 0) {
  console.warn(`⚠ ${removed.length} baseline entr${removed.length === 1 ? 'y is' : 'ies are'} no longer present.`);
  console.warn('  Prune with: node scripts/check-legacy-surface.mjs --update');
}

if (added.length > 0) {
  console.error(`✗ Legacy surface guard: ${added.length} new compatibilit${added.length === 1 ? 'y' : 'ies'} added.`);
  for (const entry of added) {
    console.error(`  - ${entry.file} [${entry.kind}] ${entry.match}`);
  }
  console.error('  Pre-1.0 policy: remove the shim, or justify it as S/P state/protocol compatibility in COMPATIBILITY.md.');
  process.exit(1);
}

console.log(`Legacy surface guard: ${current.length} known entries, no new compatibility surface.`);
