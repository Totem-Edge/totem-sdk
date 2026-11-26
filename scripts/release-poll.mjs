#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const pkgs = process.argv.slice(2).map((s) => {
  const [name, version] = s.split('@').length > 2 ? [s.slice(0, s.lastIndexOf('@')), s.slice(s.lastIndexOf('@') + 1)] : s.split('@');
  return { name, version };
});

const visible = (name, version) => {
  try {
    const out = execFileSync('npm', ['view', `${name}@${version}`, 'version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out === version;
  } catch {
    return false;
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = Date.now() + Number(process.env.POLL_DEADLINE_MS ?? 240_000);

for (;;) {
  const states = pkgs.map((p) => ({ ...p, ok: visible(p.name, p.version) }));
  const done = states.filter((s) => s.ok).length;
  console.log(`${new Date().toISOString()} ${done}/${states.length} on npm`);
  if (done === states.length) break;
  if (Date.now() > deadline) {
    console.log('TIMEOUT — not published:', states.filter((s) => !s.ok).map((s) => `${s.name}@${s.version}`).join(', '));
    process.exit(1);
  }
  await sleep(5000);
}
