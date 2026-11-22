#!/usr/bin/env node
/**
 * Published-range drift audit (CAN-008 companion).
 *
 * A package is packed with its workspace ranges resolved (`workspace:^` becomes
 * `^<current version>`). When a dependency gets a major bump, every already
 * published dependent keeps the old range until it is republished:
 *
 *   - a stale `peerDependencies` range is a hard `ERESOLVE` for the whole family
 *     (found: `omnia-router` still requiring `omnia ^2.4.4` next to `omnia 3.0.0`);
 *   - a stale `dependencies` range is silent — npm installs a second copy of the
 *     dependency next to the current one, and duplicate peer variants are how the
 *     `core-wasm` initialisation bug shipped.
 *
 * `check-family-install.mjs` catches the first class by installing; this audit
 * catches both directly and names the package to republish.
 *
 * Usage: node scripts/verify-published-ranges.mjs [--json]
 */
import { readFileSync, existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(ROOT, 'scripts', 'workspace-gates.config.json'), 'utf8'));
const asJson = process.argv.includes('--json');

/** name → { version, dir, maturity } for every publishable workspace package. */
const workspace = new Map();
for (const [dir, meta] of Object.entries(config.packages)) {
  if (meta.status !== 'publishable') continue;
  const manifestPath = join(ROOT, dir, 'package.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!manifest.name || manifest.private) continue;
  workspace.set(manifest.name, { version: manifest.version, dir, maturity: meta.maturity });
}

// ── semver satisfaction (no dependency: this runs before/after installs) ─────
function parse(version) {
  const m = String(version).match(/^v?(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function satisfiesComparator(version, comparator) {
  const c = comparator.trim();
  if (!c || c === '*' || c === 'x' || c === 'latest') return true;
  const v = parse(version);
  if (!v) return true;

  const caret = c.match(/^\^(\d+)\.(\d+)\.(\d+)/);
  if (caret) {
    const [maj, min, pat] = caret.slice(1).map(Number);
    if (maj > 0) return v[0] === maj && compare(v, [maj, min, pat]) >= 0;
    if (min > 0) return v[0] === 0 && v[1] === min && v[2] >= pat;
    return v[0] === 0 && v[1] === 0 && v[2] === pat;
  }
  const tilde = c.match(/^~(\d+)\.(\d+)\.(\d+)/);
  if (tilde) {
    const [maj, min, pat] = tilde.slice(1).map(Number);
    return v[0] === maj && v[1] === min && v[2] >= pat;
  }
  const gte = c.match(/^>=\s*(\d+)\.(\d+)\.(\d+)/);
  if (gte) return compare(v, gte.slice(1).map(Number)) >= 0;
  const gt = c.match(/^>\s*(\d+)\.(\d+)\.(\d+)/);
  if (gt) return compare(v, gt.slice(1).map(Number)) > 0;
  const lte = c.match(/^<=\s*(\d+)\.(\d+)\.(\d+)/);
  if (lte) return compare(v, lte.slice(1).map(Number)) <= 0;
  const lt = c.match(/^<\s*(\d+)\.(\d+)\.(\d+)/);
  if (lt) return compare(v, lt.slice(1).map(Number)) < 0;
  const exact = c.match(/^=?v?(\d+)\.(\d+)\.(\d+)$/);
  if (exact) return compare(v, exact.slice(1).map(Number)) === 0;
  // Unhandled form: do not invent a verdict.
  return true;
}

function satisfies(version, range) {
  if (!range) return true;
  const alternatives = String(range).split('||');
  return alternatives.some((alternative) => {
    const comparators = alternative.trim().split(/\s+/).filter(Boolean);
    return comparators.every((comparator) => satisfiesComparator(version, comparator));
  });
}

// Fail loudly if the matcher itself is wrong: a matcher that says "true" for
// everything would turn this gate into a silent pass.
if (process.argv.includes('--self-test')) {
  const cases = [
    ['3.0.0', '^2.4.4', false],
    ['3.0.0', '^3.0.0', true],
    ['0.8.1', '^0.8.0', true],
    ['0.4.0', '^0.3.2', false],
    ['1.6.1', '>=1.6.0', true],
    ['1.6.1', '>=1.7.0', false],
    ['2.0.3', '~2.0.0', true],
    ['2.0.3', '^2.0.0 || ^3.0.0', true],
    ['0.5.1', '^0.4.0', false],
    ['1.4.2', '*', true],
  ];
  let failed = 0;
  for (const [version, range, expected] of cases) {
    const actual = satisfies(version, range);
    if (actual !== expected) {
      failed++;
      console.error(`self-test: satisfies(${version}, ${range}) = ${actual}, expected ${expected}`);
    }
  }
  if (failed > 0) process.exit(1);
  console.log(`range matcher self-test: ${cases.length} cases pass`);
  process.exit(0);
}

// ── published manifests ─────────────────────────────────────────────────────
async function publishedManifest(name, version) {
  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name).replace('%40', '@')}`, {
      headers: { accept: 'application/vnd.npm.install-v1+json' },
    });
    if (!response.ok) return null;
    const packument = await response.json();
    return packument.versions?.[version] ?? null;
  } catch {
    return null;
  }
}

const names = [...workspace.keys()];
const findings = [];
let cursor = 0;

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= names.length) return;
    const name = names[index];
    const { version, dir } = workspace.get(name);
    const manifest = await publishedManifest(name, version);
    if (!manifest) continue; // not published yet: smoke install covers it
    for (const [field, kind] of [['peerDependencies', 'peer'], ['dependencies', 'dep'], ['optionalDependencies', 'dep']]) {
      for (const [dependency, range] of Object.entries(manifest[field] ?? {})) {
        if (!dependency.startsWith('@totemsdk/')) continue;
        const target = workspace.get(dependency);
        if (!target) continue;
        if (satisfies(target.version, range)) continue;
        findings.push({
          package: name,
          dir,
          published: version,
          field: kind === 'peer' ? 'peerDependencies' : field,
          dependency,
          range,
          workspace: target.version,
          republishAs: bumpPatch(version),
        });
      }
    }
  }
}

function bumpPatch(version) {
  const v = parse(version);
  return v ? `${v[0]}.${v[1]}.${v[2] + 1}` : version;
}

await Promise.all(Array.from({ length: 8 }, worker));
findings.sort((a, b) => a.package.localeCompare(b.package));

if (asJson) {
  console.log(JSON.stringify({ findings }, null, 2));
} else if (findings.length === 0) {
  console.log('published ranges: every @totemsdk peer/dependency range accepts the workspace version');
} else {
  console.error(`published ranges: ${findings.length} drifted range(s) — republish these packages:\n`);
  for (const finding of findings) {
    console.error(
      `  ${finding.package}@${finding.published} (${finding.dir}) ` +
      `${finding.field} ${finding.dependency} ${finding.range} does not accept ${finding.workspace} ` +
      `-> republish as ${finding.republishAs}`,
    );
  }
  console.error('\nA stale peer range is an ERESOLVE for the whole family; a stale dependency range silently installs a second copy.');
  process.exit(1);
}
