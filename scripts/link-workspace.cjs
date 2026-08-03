/**
 * Local-environment repair helper (NOT part of the repo build).
 *
 * The legacy node_modules predates the `workspace:^` conversion AND the repo
 * moving one directory deeper (…/CRYSTAL_LABS → …/CRYSTAL_LABS/TOTEM/totem-sdk),
 * so every relative `.pnpm/…` symlink inside a package's node_modules points
 * one level too high. The registry is unreachable, so `pnpm install` cannot
 * regenerate the tree.
 *
 * This script:
 *   1. repoints every dangling `.pnpm/<store>/node_modules/<dep>` symlink to
 *      the repo-local store (re-anchored at the current root),
 *   2. ensures `@totemsdk/*` workspace links resolve to packages/<name>,
 *   3. creates missing `@types/node`/`@types/jest` and `@protobuf-ts/runtime`
 *      links that a fresh install would provide,
 *
 * so `tsc`, `npm test` and `npm run build` work offline. It is idempotent.
 */
const { readdirSync, readlinkSync, readFileSync, mkdirSync, symlinkSync, unlinkSync, existsSync, lstatSync } = require('fs');
const { dirname, join, resolve } = require('path');

const root = process.cwd();
const packagesDir = join(root, 'packages');
const extensionsDir = join(root, 'extensions');
const dirs = [
  ...(existsSync(packagesDir) ? readdirSync(packagesDir).map(d => join(packagesDir, d)) : []),
  ...(existsSync(extensionsDir) ? readdirSync(extensionsDir).map(d => join(extensionsDir, d)) : []),
];

// Matches the `.pnpm/<store>/node_modules/<dep>` tail of a store symlink.
const PNPM_RE = /(?:^|\/)\.pnpm\/([^/]+)\/node_modules\/(.+)$/;

const storeTypes = {
  node: join(root, 'node_modules', '.pnpm', '@types+node@20.19.43', 'node_modules', '@types', 'node'),
  jest: join(root, 'node_modules', '.pnpm', '@types+jest@30.0.0', 'node_modules', '@types', 'jest'),
};
const storeScoped = {
  runtime: join(root, 'node_modules', '.pnpm', '@protobuf-ts+runtime@2.11.1', 'node_modules', '@protobuf-ts', 'runtime'),
};

// Convert legacy `.bin` cmd-shims (shell scripts with a hard-coded relative
// depth) into plain symlinks using their embedded absolute `cmd-shim-target`.
function fixBinShims(nm) {
  let count = 0;
  const bin = join(nm, '.bin');
  if (!existsSync(bin)) return 0;
  let entries;
  try {
    entries = readdirSync(bin, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const link = join(bin, e.name);
    if (e.isSymbolicLink()) continue;
    if (!e.isFile()) continue;
    let content;
    try {
      content = readFileSync(link, 'utf8');
    } catch {
      continue;
    }
    if (!content.startsWith('#!') || !content.includes('cmd-shim-target=')) continue;
    const m = content.match(/# cmd-shim-target=(.+)\n/);
    const target = m ? m[1].trim() : null;
    if (!target || !existsSync(target)) continue;
    try {
      unlinkSync(link);
      symlinkSync(target, link);
      count++;
    } catch {
      /* leave untouched on failure */
    }
  }
  return count;
}

// Reconstruct a missing top-level dep (e.g. `node_modules/jest`) from a
// dangling `.bin/<bin> -> ../<dep>/<binpath>` symlink, resolving the store
// entry that satisfies the package's declared semver range.
function parseStoreEntry(entry) {
  const scoped = entry.match(/^(@[^@/]+)\+([^@/]+)@([\d][\w.-]*)/);
  if (scoped) return { name: `${scoped[1]}/${scoped[2]}`, version: scoped[3] };
  const plain = entry.match(/^([^@/]+)@([\d][\w.-]*)/);
  if (plain) return { name: plain[1], version: plain[2] };
  return null;
}

function toTriple(v) {
  return v.split('.').map(n => parseInt(n, 10) || 0);
}

function numVersion(tri) {
  return tri[0] * 1e6 + tri[1] * 1e3 + tri[2];
}

function satisfies(version, range) {
  if (!range || range === '*' || range === 'latest') return true;
  range = String(range).replace(/^workspace:/, '').trim();
  if (range.includes('||')) return range.split('||').some(r => satisfies(version, r.trim()));
  const v = toTriple(version);
  const V = numVersion(v);
  const m = range.match(/^(\^|~|>=|<=|>|<|=)?\s*(\d+(?:\.\d+)*)/);
  if (!m) return false;
  const op = m[1] || '=';
  const base = toTriple(m[2]);
  const rest = numVersion(base);
  if (op === '^') {
    if (base[0] === 0) return v[0] === 0 && v[1] === base[1] && V >= rest;
    return v[0] === base[0] && V >= rest;
  }
  if (op === '~') return v[0] === base[0] && v[1] === base[1] && V >= rest;
  if (op === '>=') return V >= rest;
  if (op === '<=') return V <= rest;
  if (op === '>') return V > rest;
  if (op === '<') return V < rest;
  return V === rest;
}

// Collect store dirs that existing (valid) symlinks across the workspace
// already point at, keyed by dep name — mirrors the real pnpm resolution.
function collectInUse() {
  const inUse = new Map();
  const stack = [join(root, 'node_modules')];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isSymbolicLink()) {
        let target;
        try {
          target = resolve(dirname(join(dir, e.name)), readlinkSync(join(dir, e.name)));
        } catch {
          continue;
        }
        const m = target.match(/\/node_modules\/\.pnpm\/([^/]+)\/node_modules\/(.+)$/);
        if (m) {
          const parsed = parseStoreEntry(m[1]);
          if (parsed) {
            if (!inUse.has(parsed.name)) inUse.set(parsed.name, new Set());
            inUse.get(parsed.name).add(target);
          }
        }
      } else if (e.isDirectory()) {
        if (e.name === '.pnpm') continue;
        stack.push(join(dir, e.name));
      }
    }
  }
  return inUse;
}

function fixDanglingBins(nm, pkgJson, inUse) {
  let count = 0;
  const bin = join(nm, '.bin');
  if (!existsSync(bin)) return 0;
  const deps = {
    ...(pkgJson.dependencies || {}),
    ...(pkgJson.devDependencies || {}),
    ...(pkgJson.optionalDependencies || {}),
  };
  const storeBase = join(root, 'node_modules', '.pnpm');
  let storeDirs;
  try {
    storeDirs = readdirSync(storeBase);
  } catch {
    return 0;
  }
  let entries;
  try {
    entries = readdirSync(bin, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    if (!e.isSymbolicLink()) continue;
    const link = join(bin, e.name);
    let raw;
    try {
      raw = readlinkSync(link);
    } catch {
      continue;
    }
    const m = raw.match(/^\.\.\/(.+)$/);
    if (!m) continue;
    const segs = m[1].split('/');
    let dep, binpath;
    if (segs[0].startsWith('@')) {
      dep = `${segs[0]}/${segs[1]}`;
      binpath = segs.slice(2).join('/');
    } else {
      dep = segs[0];
      binpath = segs.slice(1).join('/');
    }
    const depLink = join(nm, ...dep.split('/'));
    const range = deps[dep];
    if (dep === 'typescript') continue; // owned by fixLocalTypescript (TS7 is unusable by ts-jest/tsc)
    let currentTarget = null;
    let currentVersion = null;
    if (existsSync(depLink) || lstatSyncSafe(depLink)) {
      try {
        const st = lstatSync(depLink);
        if (st.isSymbolicLink()) {
          currentTarget = resolve(dirname(depLink), readlinkSync(depLink));
          if (currentTarget.startsWith(storeBase)) {
            const entryName = currentTarget.slice(storeBase.length + 1).split('/')[0];
            const parsed = parseStoreEntry(entryName);
            if (parsed && parsed.name === dep) currentVersion = parsed.version;
          }
        } else if (st.isDirectory()) {
          continue; // real dir copy — leave alone
        }
      } catch {
        /* unreadable — treat as absent */
      }
    }
    if (currentTarget && currentVersion && range && satisfies(currentVersion, range)) continue;
    const rangeMajor = range ? (() => { const mm = String(range).match(/[~^]?\s*(\d+)/); return mm ? parseInt(mm[1], 10) : null; })() : null;
    const prefix = dep.startsWith('@') ? `${dep.replace('/', '+')}@` : `${dep}@`;
    const candidates = [];
    for (const entry of storeDirs) {
      if (!entry.startsWith(prefix)) continue;
      const parsed = parseStoreEntry(entry);
      if (!parsed || parsed.name !== dep) continue;
      const depDir = join(storeBase, entry, 'node_modules', dep);
      if (!existsSync(join(depDir, binpath))) continue;
      candidates.push({ version: parsed.version, path: depDir });
    }
    if (!candidates.length) continue;
    const used = inUse.get(dep) || new Set();
    candidates.sort((a, b) => {
      const sa = satisfies(a.version, range) ? 1 : 0;
      const sb = satisfies(b.version, range) ? 1 : 0;
      if (sa !== sb) return sb - sa;
      const ia = used.has(a.path) ? 1 : 0;
      const ib = used.has(b.path) ? 1 : 0;
      if (ia !== ib) return ib - ia;
      const am = parseInt(a.version, 10);
      const bm = parseInt(b.version, 10);
      const af = rangeMajor != null && am <= rangeMajor ? 0 : 1;
      const bf = rangeMajor != null && bm <= rangeMajor ? 0 : 1;
      if (af !== bf) return af - bf;
      return numVersion(toTriple(b.version)) - numVersion(toTriple(a.version));
    });
    const target = candidates[0].path;
    if (currentTarget === target) continue;
    try {
      if (currentTarget) unlinkSync(depLink);
      if (dep.startsWith('@')) {
        const scopeDir = join(nm, dep.split('/')[0]);
        if (!existsSync(scopeDir)) mkdirSync(scopeDir, { recursive: true });
      }
      symlinkSync(target, depLink);
      count++;
    } catch {
      /* skip on failure */
    }
  }
  return count;
}

function lstatSyncSafe(p) {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

function mkdirSyncSafe(p) {
  try {
    mkdirSync(p, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function ensureLink(link, target) {
  if (!target || !existsSync(join(target, 'package.json')) && !existsSync(join(target, 'index.d.ts'))) return false;
  try {
    const st = lstatSync(link);
    if (st.isSymbolicLink()) {
      if (readlinkSync(link) === target) return false;
      unlinkSync(link);
    } else {
      return false;
    }
  } catch {
    /* absent — create below */
  }
  symlinkSync(target, link);
  return true;
}

// Re-anchor dangling `.pnpm/…` symlinks to the repo-local store.
function fixDangling(nm) {
  let count = 0;
  const stack = [nm];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isSymbolicLink()) {
        const link = join(dir, e.name);
        let raw;
        try {
          raw = readlinkSync(link);
        } catch {
          continue;
        }
        if (existsSync(resolve(dirname(link), raw))) continue;
        const m = raw.match(PNPM_RE);
        if (!m) continue;
        const target = join(root, 'node_modules', '.pnpm', m[1], 'node_modules', m[2]);
        if (!existsSync(target)) continue;
        try {
          unlinkSync(link);
          symlinkSync(target, link);
          count++;
        } catch {
          /* leave untouched on failure */
        }
      } else if (e.isDirectory()) {
        stack.push(join(dir, e.name));
      }
    }
  }
  return count;
}

// ts-jest peers a specific `typescript` store instance (resolved from the
// ts-jest package's own location). Instances created against TypeScript 7
// cannot compile anything (TS7 dropped the JS compiler API), so repoint them
// at the root-resolved TypeScript (5.9.3).
function fixStoreTsJest() {
  let count = 0;
  const storeBase = join(root, 'node_modules', '.pnpm');
  let tsTarget;
  try {
    tsTarget = resolve(join(root, 'node_modules', 'typescript'), '');
  } catch {
    return 0;
  }
  if (!existsSync(tsTarget)) return 0;
  let storeDirs;
  try {
    storeDirs = readdirSync(storeBase);
  } catch {
    return 0;
  }
  for (const entry of storeDirs) {
    if (!entry.startsWith('ts-jest@')) continue;
    const link = join(storeBase, entry, 'node_modules', 'typescript');
    let st;
    try {
      st = lstatSync(link);
    } catch {
      continue;
    }
    if (!st.isSymbolicLink()) continue;
    if (resolve(dirname(link), readlinkSync(link)) === tsTarget) continue;
    try {
      unlinkSync(link);
      symlinkSync(tsTarget, link);
      count++;
    } catch {
      /* skip on failure */
    }
  }
  return count;
}

// The workspace pins `typescript: ^7.0.2` in most packages, but TS7 dropped
// the JS compiler API that ts-jest (and `moduleResolution: node`) rely on.
// The lockfile/root store resolve TypeScript 5.9.3; repoint any package-local
// `typescript` link that currently resolves to a 7.x store copy so that
// ts-jest/tsc actually use a compiler API version. Idempotent.
function fixLocalTypescript(nm) {
  const link = join(nm, 'typescript');
  let st;
  try {
    st = lstatSync(link);
  } catch {
    return 0;
  }
  if (!st.isSymbolicLink()) return 0;
  const resolved = resolve(dirname(link), readlinkSync(link));
  const tsTarget = resolve(join(root, 'node_modules', 'typescript'), '');
  if (resolved === tsTarget) return 0;
  if (!existsSync(resolved)) return 0;
  let version;
  try {
    version = require(join(resolved, 'package.json')).version;
  } catch {
    return 0;
  }
  if (!version.startsWith('7.')) return 0;
  try {
    unlinkSync(link);
    symlinkSync(tsTarget, link);
    return 1;
  } catch {
    return 0;
  }
}

let fixed = 0;
const inUse = collectInUse();
fixed += fixStoreTsJest();
for (const pkg of dirs) {
  const nm = join(pkg, 'node_modules');
  if (!existsSync(nm)) continue;

  let pkgJson = {};
  try {
    pkgJson = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
  } catch {
    /* keep empty */
  }

  fixed += fixDangling(nm);
  fixed += fixBinShims(nm);
  fixed += fixDanglingBins(nm, pkgJson, inUse);
  fixed += fixLocalTypescript(nm);

  const scope = join(nm, '@totemsdk');
  if (existsSync(scope) || mkdirSyncSafe(scope)) {
    for (const name of readdirSync(packagesDir)) {
      const link = join(scope, name);
      const target = join(root, 'packages', name);
      if (existsSync(target) && ensureLink(link, target)) fixed++;
    }
  }
  const types = join(nm, '@types');
  if (existsSync(types)) {
    for (const name of Object.keys(storeTypes)) {
      if (ensureLink(join(types, name), storeTypes[name])) fixed++;
    }
  }
  const protobufTs = join(nm, '@protobuf-ts');
  if (existsSync(protobufTs)) {
    for (const name of Object.keys(storeScoped)) {
      const dir = join(protobufTs, name);
      if (!existsSync(dir) && ensureLink(dir, storeScoped[name])) fixed++;
    }
  }
}

if (existsSync(join(root, 'node_modules'))) {
  fixed += fixBinShims(join(root, 'node_modules'));
}

console.log(`[link-workspace] ensured ${fixed} symlinks`);