#!/usr/bin/env node
/**
 * SDK integration hygiene.
 *
 * v1 packages must consume shared Totem contracts, not fork storage/device
 * implementations. RC/Alpha packages are reported as debt but do not block;
 * this keeps migration visible without freezing unrelated work.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(ROOT, 'scripts/workspace-gates.config.json'), 'utf8'));
const STORAGE_CONTRACT_OWNERS = new Set(['packages/core', 'packages/storage']);
const FORBIDDEN_DRIVERS = /better-sqlite3|node:sqlite|from ['"]sqlite3['"]|from ['"](level|levelup|classic-level|lmdb|ioredis|mongodb)['"]/;
const STORAGE_CONTRACT = /^(?:export\s+)?interface\s+(StorageAdapter|CasStore|TransactionalStore|StoreCapabilities)\b|^export\s+type\s+(WriteAckMode)\b/;
const EDGE_RAW_TRANSPORT = /from ['"](mqtt|serialport|modbus-serial|ws|node:net|net|node:tls|tls)['"]/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', 'rust', 'target', 'pkg', 'pkg-node', 'pkg-web', '__tests__', 'test', 'tests']);

function sourceFiles(dir) {
  const files = [];
  function walk(path) {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name) || entry.name.includes('mock')) continue;
      const full = join(path, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) files.push(full);
    }
  }
  walk(join(dir, 'src'));
  return files;
}

const findings = [];
for (const [dir, meta] of Object.entries(config.packages)) {
  if (meta.status !== 'publishable') continue;
  const manifestPath = join(ROOT, dir, 'package.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const deps = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) };
  const isEdgeConnector = dir === 'packages/edge' || dir.startsWith('packages/edge-');
  for (const file of sourceFiles(join(ROOT, dir))) {
    const source = readFileSync(file, 'utf8');
    const relative = file.slice(ROOT.length + 1);
    if (!STORAGE_CONTRACT_OWNERS.has(dir) && FORBIDDEN_DRIVERS.test(source)) {
      findings.push({ dir, level: meta.maturity ?? 'unclassified', rule: 'direct-db-driver', detail: relative });
    }
    if (!STORAGE_CONTRACT_OWNERS.has(dir) && source.split('\n').some((line) => STORAGE_CONTRACT.test(line.trim()))) {
      findings.push({ dir, level: meta.maturity ?? 'unclassified', rule: 'forked-storage-contract', detail: relative });
    }
    if (isEdgeConnector && EDGE_RAW_TRANSPORT.test(source)) {
      findings.push({ dir, level: meta.maturity ?? 'unclassified', rule: 'raw-device-transport', detail: relative });
    }
    if (/from ['"]@totemsdk\/storage/.test(source) && !deps['@totemsdk/storage']) {
      findings.push({ dir, level: meta.maturity ?? 'unclassified', rule: 'undeclared-sdk-storage', detail: relative });
    }
  }
  if (FORBIDDEN_DRIVERS.test(Object.keys(manifest.dependencies ?? {}).join(' ')) && !STORAGE_CONTRACT_OWNERS.has(dir)) {
    findings.push({ dir, level: meta.maturity ?? 'unclassified', rule: 'direct-db-dependency', detail: 'package.json' });
  }
}

const v1 = findings.filter((finding) => finding.level === 'v1');
for (const finding of findings) {
  process.stdout.write(`${finding.level === 'v1' ? 'FAIL' : 'debt'}: ${finding.dir} ${finding.rule} (${finding.detail})\n`);
}
if (v1.length) {
  process.stderr.write(`SDK integration hygiene failed for ${v1.length} v1 finding(s).\n`);
  process.exit(1);
}
process.stdout.write(`SDK integration hygiene: ${findings.length} non-v1 debt finding(s), 0 v1 blockers.\n`);
