#!/usr/bin/env node
/**
 * Runtime portability smoke test for the host-independent SDK surface.
 *
 * Runs the same checks under Node, Bun, and Bare:
 *   node scripts/runtime-smoke.cjs
 *   bun  scripts/runtime-smoke.cjs
 *   bare scripts/runtime-smoke.cjs
 *
 * Native network check:
 *   OMNIA_SMOKE_HOST=<LAN IP> node scripts/runtime-smoke.cjs --native
 *   (hyperdht cannot bootstrap on 127.0.0.1)
 *
 * Bare note: Bare has no Buffer/TextEncoder/TextDecoder/process globals, so the
 * harness installs minimal shims. The current blocker is
 * @totemsdk/core-wasm/pkg-node importing node's `fs`; a Bare-target WASM build or
 * an fs/bare-fs shim is required. Node and Bun run the full SDK surface.
 *
 * Checks:
 *   - @totemsdk/core hashing
 *   - @totemsdk/txpow difficulty helpers
 *   - @totemsdk/stream-transport in-memory duplex
 *   - @totemsdk/omnia framing + peer message round-trip
 *   - @totemsdk/omnia-factory full factory / virtual-channel lifecycle
 *   - (--native) two native Hyperswarm swarms over a real DHT seed
 *
 * Anything requiring Node-only built-ins (fs/sqlite/http, omnia-host) is out of
 * scope: this measures whether the *SDK* is runtime-portable.
 */
'use strict';

// ── Bare compatibility shim ───────────────────────────────────────────────────
// Bare is intentionally minimal: Node's `Buffer`, `TextEncoder`/`TextDecoder`
// and `process` are not globals. Most Bare apps install these (bare-buffer and
// friends); the shim lets this harness measure the SDK itself rather than the
// runtime's globals. It is reported explicitly in the output.
let bareShim = null;
if (typeof Bare !== 'undefined') {
  const applied = [];
  const bareArgs = Array.isArray(Bare.argv) ? Bare.argv : [];
  const bareBufferArg = bareArgs.find((a) => typeof a === 'string' && a.startsWith('--bare-buffer='));
  const bareBufferPath = bareBufferArg ? bareBufferArg.slice('--bare-buffer='.length) : null;
  if (typeof globalThis.Buffer === 'undefined') {
    for (const candidate of ['bare-buffer', bareBufferPath]) {
      if (!candidate) continue;
      try {
        globalThis.Buffer = require(candidate);
        applied.push('Buffer');
        break;
      } catch (err) {
        if (bareArgs.includes('--verbose')) console.log(`bare buffer candidate failed: ${candidate} — ${err.message}`);
      }
    }
  }
  if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = class {
      encode(str) {
        const out = [];
        for (let i = 0; i < str.length; i += 1) {
          let c = str.charCodeAt(i);
          if (c < 0x80) out.push(c);
          else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
          else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
            const c2 = str.charCodeAt(++i);
            const cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
            out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
          } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
        }
        return Uint8Array.from(out);
      }
    };
    applied.push('TextEncoder');
  }
  if (typeof globalThis.TextDecoder === 'undefined') {
    globalThis.TextDecoder = class {
      decode(u8) {
        if (u8 === undefined || u8 === null || u8.length === 0) return '';
        let out = '';
        for (let i = 0; i < u8.length;) {
          const b = u8[i++];
          if (b < 0x80) out += String.fromCharCode(b);
          else if (b < 0xe0) out += String.fromCharCode(((b & 0x1f) << 6) | (u8[i++] & 0x3f));
          else if (b < 0xf0) out += String.fromCharCode(((b & 0x0f) << 12) | ((u8[i++] & 0x3f) << 6) | (u8[i++] & 0x3f));
          else {
            const cp = ((b & 0x07) << 18) | ((u8[i++] & 0x3f) << 12) | ((u8[i++] & 0x3f) << 6) | (u8[i++] & 0x3f);
            const v = cp - 0x10000;
            out += String.fromCharCode(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
          }
        }
        return out;
      }
    };
    applied.push('TextDecoder');
  }
  if (typeof globalThis.process === 'undefined') {
    globalThis.process = {
      env: {},
      argv: Array.isArray(Bare.argv) ? Bare.argv : [],
      exit: (code) => { if (typeof Bare.exit === 'function') Bare.exit(code); },
    };
    applied.push('process');
  }
  bareShim = applied;
}

// Minimal assert (no `node:` built-ins: this runs under Bare too).
const assert = (value, message) => { if (!value) throw new Error(message || 'assertion failed'); };
assert.ok = assert;
assert.strictEqual = (actual, expected, message) => {
  if (actual !== expected) throw new Error(message || `expected ${String(expected)}, got ${String(actual)}`);
};
assert.deepStrictEqual = (actual, expected, message) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

const argv = (typeof process !== 'undefined' && Array.isArray(process.argv)) ? process.argv
  : (typeof Bare !== 'undefined' && Array.isArray(Bare.argv)) ? Bare.argv : [];
const env = (typeof Bare !== 'undefined' && Bare.env && typeof Bare.env === 'object') ? Bare.env
  : (typeof process !== 'undefined' && process.env) ? process.env : {};

const runtime =
  typeof Bun !== 'undefined' ? `bun ${Bun.version}` :
  typeof Bare !== 'undefined' ? `bare ${Bare.version}` :
  typeof process !== 'undefined' && process.versions && process.versions.node ? `node ${process.versions.node}` :
  'unknown';

const wantNative = argv.includes('--native');

// Resolve workspace packages by path: pnpm links them inside each package's
// node_modules, not at the repo root, and Bare has no Node module resolver.
const load = (pkg, entry) => require(`${__dirname}/../packages/${pkg}/${entry || 'dist/cjs/index.js'}`);
const bytes = (text) => Uint8Array.from(text, (c) => c.charCodeAt(0));
const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
const results = [];

class Skip extends Error {}

function record(name, status, detail) {
  results.push({ name, ok: status !== 'fail', status, detail });
  console.log(`${status.toUpperCase()} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, 'pass', typeof detail === 'string' ? detail : undefined);
  } catch (err) {
    if (err instanceof Skip) {
      record(name, 'skip', err.message);
      return;
    }
    record(name, 'fail', err && err.stack ? err.stack.split('\n')[0] : String(err));
    if (env.RUNTIME_SMOKE_VERBOSE || argv.includes('--verbose')) console.error(err && err.stack ? err.stack : err);
  }
}

function requireSdk(pkg, entry) {
  try {
    return load(pkg, entry);
  } catch (err) {
    const detail = err && err.stack ? err.stack : (err && err.message ? err.message : String(err));
    throw new Error(`cannot load ${pkg}: ${detail}`);
  }
}

// ── Fixtures: deterministic WOTS lease bundles (no real key material) ─────────
function makeBundle(publicKeyDigest) {
  let counter = 0;
  const leaseProvider = {
    reserveKeyUse: async () => ({
      reservationId: `res-${counter++}`,
      indices: { addressIndex: 0, l1: 0, l2: counter - 1 },
      expiresAt: Date.now() + 60_000,
    }),
    commitKeyUse: async () => {},
    burnReservation: async () => {},
  };
  return {
    leaseProvider,
    signer: {
      publicKeyDigest,
      sign: async () => new Uint8Array(64).fill(0x42),
    },
    verify: () => true,
  };
}

async function main() {
  console.log(`runtime: ${runtime}`);
  if (bareShim) console.log(`bare shim: ${bareShim.length ? bareShim.join(', ') : 'none'}`);

  await check('core: sha3_256', () => {
    const { sha3_256 } = requireSdk('core');
    const digest = sha3_256(bytes('totem'));
    const digestHex = hex(digest);
    assert.strictEqual(
      digestHex,
      '0e9773d66e105e353ec9afc9845a9cab941a74d568b22b14cb249fbd37e5b136',
      `unexpected sha3_256: ${digestHex}`,
    );
    return digestHex.slice(0, 16);
  });

  await check('txpow: target/difficulty helpers', () => {
    const { targetFromMinWork, isLessThan, MAX_HASH } = requireSdk('txpow');
    const target = targetFromMinWork('0x2710');
    assert(target instanceof Uint8Array && target.length === 32, 'target must be 32 bytes');
    assert(isLessThan(new Uint8Array(32), target), 'zero hash should meet the target');
    assert.strictEqual(isLessThan(MAX_HASH, target), false);
    return `target=${hex(target).slice(0, 8)}…`;
  });

  await check('stream-transport: in-memory duplex', async () => {
    const { createInMemoryPair } = requireSdk('stream-transport');
    const [a, b] = createInMemoryPair();
    const received = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no data')), 1_000);
      b.onData((chunk) => {
        clearTimeout(timer);
        resolve(String.fromCharCode.apply(null, Array.from(chunk)));
      });
    });
    await a.send(bytes('ping'));
    assert.strictEqual(await received, 'ping');
    await a.close();
    await b.close();
  });

  await check('omnia: peer message round-trip', async () => {
    const { OmniaPeerImpl } = requireSdk('omnia');
    const { createInMemoryPair } = requireSdk('stream-transport');
    const [ta, tb] = createInMemoryPair();
    const pa = new OmniaPeerImpl(ta, { pubkey: 'a' });
    const pb = new OmniaPeerImpl(tb, { pubkey: 'b' });
    const received = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no message')), 1_000);
      pb.onMessage((msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });
    await pa.sendMessage({ type: 'ACK', channelId: 'c1', nonce: 7, payload: { ok: true } });
    const msg = await received;
    assert.strictEqual(msg.type, 'ACK');
    assert.strictEqual(msg.nonce, 7);
    assert.deepStrictEqual(msg.payload, { ok: true });
    await pa.sendMessage({ type: 'ACK', channelId: 'c1', nonce: 8, payload: {} });
    pa.disconnect();
    pb.disconnect();
  });

  await check('omnia-factory: factory + virtual channel lifecycle', async () => {
    const {
      createFactory,
      acceptFactory,
      openVirtualChannel,
      closeVirtualChannel,
    } = requireSdk('omnia-factory');

    const alice = {
      partyId: 'alice',
      publicKeyDigest: '0x' + 'aa'.repeat(32),
      addressIndex: 0,
      contributionAmount: 1000n,
    };
    const bob = {
      partyId: 'bob',
      publicKeyDigest: '0x' + 'bb'.repeat(32),
      addressIndex: 1,
      contributionAmount: 1000n,
    };
    const aBundle = makeBundle(alice.publicKeyDigest);
    const bBundle = makeBundle(bob.publicKeyDigest);

    let factory = await createFactory([alice, bob], '0x00', aBundle);
    factory = await acceptFactory(factory, bBundle);
    assert.strictEqual(factory.status, 'active');

    const bundles = { alice: aBundle, bob: bBundle };
    const opened = await openVirtualChannel(
      factory,
      ['alice', 'bob'],
      { alice: 250n, bob: 250n },
      bundles,
    );
    assert.strictEqual(opened.factory.virtualChannels.length, 1);
    assert.strictEqual(opened.channel.totalValue, 500n);

    const closed = await closeVirtualChannel(opened.factory, opened.channel, bundles);
    assert.strictEqual(closed.virtualChannels.length, 0);
    assert.strictEqual(closed.allocations.alice, 1000n);
    assert.strictEqual(closed.allocations.bob, 1000n);

    return `vc=${opened.channel.channelId.slice(0, 8)}…`;
  });

  if (wantNative) {
    await check('omnia: native Hyperswarm loopback', nativeLoopback);
  }

  const failed = results.filter((r) => r.status === 'fail');
  const skipped = results.filter((r) => r.status === 'skip');
  console.log(`\n${results.length - failed.length}/${results.length} checks passed on ${runtime}` +
    (skipped.length ? ` (${skipped.length} skipped)` : ''));
  if (typeof Bare !== 'undefined' && failed.some((r) => /\bfs\b/.test(String(r.detail)))) {
    console.error('NOTE: Bare is blocked by core-wasm/pkg-node importing node:fs; build a Bare WASM target or shim fs/bare-fs.');
  }
  if (failed.length) {
    console.error(`failed: ${failed.map((r) => r.name).join(', ')}`);
    if (typeof process !== 'undefined' && process.exit) process.exit(1);
  }
}

async function nativeLoopback() {
  if (typeof Bun !== 'undefined') {
    throw new Skip('Bun 1.3.14 panics in udx-native (uv_interface_addresses); native Hyperswarm is Node/Bare-only for now');
  }
  if (typeof Buffer === 'undefined') throw new Error('Buffer is not available in this runtime');
  const host = env.OMNIA_SMOKE_HOST || env.HOST_IP || '127.0.0.1';
  if (host === '127.0.0.1' || host === 'localhost') {
    throw new Skip('hyperdht cannot bootstrap on loopback; set OMNIA_SMOKE_HOST=<LAN IP> to run the native check');
  }
  const DHT = requireSdk('omnia', 'node_modules/hyperdht');
  const { createOmniaSwarm } = requireSdk('omnia');

  const bufHex = (u8) => Buffer.from(u8).toString('hex');
  const kpA = DHT.keyPair(Buffer.alloc(32, 0xa1));
  const kpB = DHT.keyPair(Buffer.alloc(32, 0xb2));
  const pubA = '0x' + 'a1'.repeat(32);
  const pubB = '0x' + 'b2'.repeat(32);

  // Two-node DHT: B bootstraps to A's host node (a regular DHT stores and
  // routes announces; DHT.bootstrapper does not).
  const swarmA = await createOmniaSwarm({
    relay: { mode: 'native' },
    host,
    port: 39258,
    keyPair: kpA,
    localPubkey: pubA,
  });
  const swarmB = await createOmniaSwarm({
    relay: { mode: 'native' },
    bootstrap: [`${bufHex(kpA.publicKey)}@${host}:39258`],
    host,
    port: 39259,
    keyPair: kpB,
    localPubkey: pubB,
  });

  const cleanup = async () => {
    await Promise.allSettled([swarmA.close(), swarmB.close()]);
  };

  try {
    swarmA.listenForChannels(async (peer, msg) => {
      if (msg.type === 'PING') {
        await peer.sendMessage({
          type: 'ACK',
          channelId: msg.channelId,
          nonce: msg.nonce,
          payload: { pong: true },
        });
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 1_000));
    let peer;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        peer = await swarmB.connectToPeer(pubA, 'c1', bufHex(kpA.publicKey));
        break;
      } catch (err) {
        if (attempt === 2) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
    }

    const reply = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error('native loopback timeout'));
      }, 20_000);
      const unsub = peer.onMessage((msg) => {
        if (msg.type !== 'ACK' || msg.channelId !== 'c1') return;
        clearTimeout(timer);
        unsub();
        resolve(msg);
      });
      peer.sendMessage({ type: 'PING', channelId: 'c1', nonce: 1, payload: {} }).catch((err) => {
        clearTimeout(timer);
        unsub();
        reject(err);
      });
    });
    assert.strictEqual(reply.payload && reply.payload.pong, true);
    return 'ping/pong';
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  if (typeof process !== 'undefined' && process.exit) process.exit(1);
});
