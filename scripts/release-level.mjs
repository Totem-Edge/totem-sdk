#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const LEVELS = {
  0: [
    ['chain-provider', '0.5.0', 'rc'],
    ['claim', '0.1.0', 'alpha'],
    ['omnia-lsp', '0.2.0', 'alpha'],
  ],
  1: [
    ['omnia', '4.0.0', 'rc'],
    ['vtxo', '0.10.0', 'rc'],
    ['omnia-lsp-provider', '0.2.0', 'alpha'],
  ],
  2: [
    ['omnia-router', '0.6.0', 'rc'],
    ['omnia-factory', '0.9.0', 'rc'],
    ['omnia-splice', '0.4.0', 'rc'],
  ],
  3: [
    ['omnia-pool', '0.7.0', 'rc'],
    ['omnia-relay', '0.11.0', 'rc'],
  ],
  4: [['omnia-host', '0.16.0', 'rc']],
};

const level = Number(process.argv[2]);
const pkgs = LEVELS[level];
if (!pkgs) {
  console.error('usage: release-level.mjs <0-4>');
  process.exit(2);
}

const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * Retry a transient GitHub/network failure. The level-3 run lost a release
 * creation to `read: connection reset by peer` and a TLS handshake timeout;
 * both succeed on retry, and release creation is idempotent because the tag is
 * already pushed.
 */
function withRetry(label, fn, attempts = 4) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return fn();
    } catch (error) {
      const message = String(error.stderr ?? error.message ?? error).split('\n')[0];
      if (attempt >= attempts) throw error;
      console.warn(`  retry ${attempt}/${attempts - 1} ${label}: ${message}`);
      execFileSync('sleep', [String(attempt * 3)]);
    }
  }
}

for (const [slug, ver, maturity] of pkgs) {
  const tag = `totemsdk/${slug}-v${ver}`;
  try {
    run('git', ['rev-parse', '--verify', `refs/tags/${tag}`]);
    console.log(`= ${tag} already tagged`);
  } catch {
    run('git', ['tag', '-a', tag, 'HEAD', '-m', `Release @totemsdk/${slug}@${ver} (maturity: ${maturity})`]);
    withRetry(`push ${tag}`, () => run('git', ['push', '-q', 'origin', tag]));
    console.log(`+ tagged ${tag}`);
  }
  try {
    withRetry(`release ${tag}`, () => run('gh', [
      'release', 'create', tag,
      '--title', `@totemsdk/${slug} ${ver}`,
      '--notes', `Release @totemsdk/${slug}@${ver} (maturity: ${maturity}) — Omnia audit remediation.`,
      '--verify-tag',
    ]));
    console.log(`  released ${tag}`);
  } catch (error) {
    const msg = String(error.stderr ?? error.message);
    if (msg.includes('already exists')) console.log(`  release ${tag} already exists`);
    else {
      console.error(`  FAILED ${tag}: ${msg}`);
      process.exitCode = 1;
    }
  }
}
