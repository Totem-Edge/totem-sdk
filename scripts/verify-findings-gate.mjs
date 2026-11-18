#!/usr/bin/env node
/**
 * Findings release gate (RFC-063 evidence surface).
 *
 * `docs/findings/findings.json` is generated from the canary register (see
 * `docs/findings/README.md`). This gate is the release-time counterpart to the
 * canary's `scripts/findings.ts --gate`: it refuses to publish a package while
 * an open finding at or above the severity threshold names it.
 *
 * Usage:
 *   node scripts/verify-findings-gate.mjs --report
 *   node scripts/verify-findings-gate.mjs --min-severity high --packages @totemsdk/omnia
 *   node scripts/verify-findings-gate.mjs            # same as --min-severity high, all packages
 *
 * Exit codes: 0 pass, 1 blocked, 2 usage/data error.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'docs', 'findings', 'findings.json');

const SEVERITY = { critical: 4, high: 3, medium: 2, low: 1 };
const BLOCKING = new Set(['open', 'in-progress']);

const args = process.argv.slice(2);
function valueOf(flag) {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const next = args[index + 1];
  return next && !next.startsWith('--') ? next : undefined;
}

const report = args.includes('--report');
const minSeverity = valueOf('--min-severity') ?? 'high';
if (!(minSeverity in SEVERITY)) {
  process.stderr.write(`findings-gate: --min-severity must be one of ${Object.keys(SEVERITY).join(', ')}\n`);
  process.exit(2);
}
const packages = (valueOf('--packages') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (!existsSync(MANIFEST)) {
  process.stderr.write(
    `findings-gate: ${MANIFEST} is missing. Generate it from the canary registry:\n`
    + '  cd artifacts/canary && pnpm run findings --sdk <sdk-checkout> --write <sdk-checkout>/docs/findings\n',
  );
  process.exit(2);
}

let findings;
try {
  const parsed = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  findings = Array.isArray(parsed.findings) ? parsed.findings : null;
} catch (error) {
  process.stderr.write(`findings-gate: cannot parse ${MANIFEST}: ${error.message}\n`);
  process.exit(2);
}
if (!findings) {
  process.stderr.write(`findings-gate: ${MANIFEST} has no findings array\n`);
  process.exit(2);
}

const byId = new Map(findings.map((finding) => [finding.id, finding]));
const open = findings.filter((finding) => BLOCKING.has(finding.status));
const blocked = [];
const aliases = [];
const below = [];
const outOfScope = [];

for (const finding of open) {
  // OMN-031: an alias may only be suppressed when its canonical entry is itself
  // blocking at the same or higher severity. A fixed canonical row must never
  // hide an open alias.
  if (finding.canonical) {
    const canonical = byId.get(finding.canonical);
    if (
      canonical
      && BLOCKING.has(canonical.status)
      && SEVERITY[canonical.severity] >= SEVERITY[finding.severity]
    ) {
      aliases.push(finding);
      continue;
    }
  }
  if (packages.length > 0 && !finding.packages?.some((pkg) => packages.includes(pkg))) {
    outOfScope.push(finding);
    continue;
  }
  if (SEVERITY[finding.severity] >= SEVERITY[minSeverity]) blocked.push(finding);
  else below.push(finding);
}

blocked.sort((a, b) => SEVERITY[b.severity] - SEVERITY[a.severity] || String(a.id).localeCompare(String(b.id)));

const scope = packages.length > 0 ? ` for ${packages.join(', ')}` : '';
const summary =
  `findings-gate: ${open.length} open, ${blocked.length} at or above ${minSeverity}${scope}`
  + ` (${below.length} below threshold, ${outOfScope.length} out of scope, ${aliases.length} aliased)`;

if (blocked.length > 0) {
  process.stderr.write(`${summary}\n`);
  for (const finding of blocked) {
    process.stderr.write(
      `  ${finding.id} [${finding.severity}] ${finding.title} (${(finding.packages ?? []).join(', ')})\n`,
    );
  }
  if (!report) {
    process.stderr.write(
      '\nResolve or downgrade these in artifacts/canary/src/findings/registry.ts, regenerate docs/findings, then retry.\n',
    );
    process.exit(1);
  }
  process.exit(0);
}

process.stdout.write(`${summary}\n`);
