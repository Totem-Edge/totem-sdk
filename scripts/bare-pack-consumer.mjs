#!/usr/bin/env node
/**
 * Packed-consumer Bare gate.
 *
 * Installs the real @totemsdk/core tarballs into a non-symlinked temp project,
 * builds a bare-pack bundle, and runs SHA3/WOTS through the public ESM entry.
 * The WASM is embedded as base64 so the test measures the module graph, not
 * external file placement.
 */
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = mkdtempSync(join(tmpdir(), 'totem-bare-pack-'));

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
}

try {
  run('pnpm', ['--filter', '@totemsdk/core', 'pack', '--pack-destination', temp], ROOT);
  run('pnpm', ['--filter', '@totemsdk/core-wasm', 'pack', '--pack-destination', temp], ROOT);
  const tarballs = readdirSync(temp).filter((name) => name.endsWith('.tgz'));
  const coreName = tarballs.find((name) => /^totemsdk-core-\d/.test(name));
  const wasmName = tarballs.find((name) => /^totemsdk-core-wasm-\d/.test(name));
  if (!coreName || !wasmName) throw new Error('packed tarballs missing');
  const coreTgz = join(temp, coreName);
  const wasmTgz = join(temp, wasmName);

  writeFileSync(join(temp, 'package.json'), JSON.stringify({
    private: true, type: 'module',
  }, null, 2));
  run('npm', [
    'install', '--ignore-scripts', '--no-audit', '--no-fund',
    coreTgz, wasmTgz, 'bare-encoding@1.0.3', 'bare-crypto@1.15.4',
  ], temp);

  const wasm = readFileSync(join(temp, 'node_modules', '@totemsdk', 'core-wasm', 'pkg-web', 'totemsdk_core_wasm_bg.wasm'));
  writeFileSync(join(temp, 'wasm-bytes.mjs'), `export default ${JSON.stringify(wasm.toString('base64'))};\n`);
  writeFileSync(join(temp, 'imports.json'), JSON.stringify({ 'node:crypto': 'bare-crypto' }, null, 2));

  writeFileSync(join(temp, 'entry.mjs'), `
import 'bare-encoding/global';
import wasmB64 from './wasm-bytes.mjs';
import { initSync, sha3_256, wotsSign, derivePKdigest, wotsVerifyDigest } from '@totemsdk/core';
function decode(input) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = input.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let bits = 0, value = 0, index = 0;
  for (let i = 0; i < clean.length; i++) {
    value = (value << 6) | chars.indexOf(clean[i]); bits += 6;
    if (bits >= 8) { bits -= 8; out[index++] = (value >> bits) & 0xff; }
  }
  return out.subarray(0, index);
}
initSync({ module: new WebAssembly.Module(decode(wasmB64)) });
const message = sha3_256(new TextEncoder().encode('packed-bare'));
const seed = new Uint8Array(32).fill(9);
const pk = derivePKdigest(seed, 0);
const signature = wotsSign(seed, 0, message);
if (!wotsVerifyDigest(signature, message, pk)) throw new Error('WOTS verification failed');
console.log('packed bare core ok:', message.length, pk.length, signature.length);
`);

  mkdirSync(join(temp, 'dist'));
  run(join(ROOT, 'node_modules', '.bin', 'bare-pack'), [
    '--imports', 'imports.json', '--offload', '--format', 'bundle',
    '--out', 'dist/bundle.bundle', 'entry.mjs',
  ], temp);

  const result = run(process.execPath, [join(ROOT, 'scripts', 'run-bare.mjs'), join(temp, 'dist', 'bundle.bundle')], ROOT);
  process.stdout.write(result);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
