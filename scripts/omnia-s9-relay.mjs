#!/usr/bin/env node
/**
 * S9 — browser-safe relay round-trip.
 *
 * Starts a self-hosted relay, connects two `HostedRelaySwarmImpl` clients, and
 * sends a message in both directions over the relay (the same wire protocol the
 * wallet-side client uses). No node, chain, or cloud host is required.
 *
 * Flags:
 *   --json        only print the final result JSON
 *
 * Result: prints an `OMNIA_RESULT {...}` line; use it to update
 * docs/OMNIA_TEST_RESULTS.md.
 */
import { createRequire } from 'node:module';

// Use the CJS builds: they resolve core-wasm's node target (pkg-node), whereas
// the ESM entry is the bundler target and expects a bundler to provide the .wasm.
const require = createRequire(import.meta.url);
const { createRelayServer } = require('../packages/omnia-relay/dist/cjs/server.js');
const { createOmniaSwarm } = require('../packages/omnia/dist/cjs/index.js');

const JSON_ONLY = process.argv.includes('--json');
const log = (...args) => { if (!JSON_ONLY) console.log(...args); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PUB_A = process.env.OMNIA_S9_PUB_A ?? '0x' + 'a1'.repeat(32);
const PUB_B = process.env.OMNIA_S9_PUB_B ?? '0x' + 'b2'.repeat(32);

function waitForMessage(peer, channelId, type, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`timed out waiting for ${type} on ${channelId}`));
    }, timeoutMs);
    const unsubscribe = peer.onMessage((msg) => {
      if (msg.channelId !== channelId || msg.type !== type) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(msg);
    });
  });
}

async function waitFor(label, attempts, delayMs, fn) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      last = await fn();
      if (last) return last;
    } catch (err) {
      last = err;
    }
    await sleep(delayMs);
  }
  throw new Error(`${label} timed out`);
}

async function main() {
  const relay = createRelayServer({ port: 0, host: '127.0.0.1' });
  const { url, port } = await relay.start();
  log('relay', url);

  const a = await createOmniaSwarm({
    relay: { mode: 'self-hosted', relayUrl: url },
    localPubkey: PUB_A,
  });
  const b = await createOmniaSwarm({
    relay: { mode: 'self-hosted', relayUrl: url },
    localPubkey: PUB_B,
  });

  try {
    // A answers PING over the relay; B drives the request.
    a.listenForChannels(async (peer, msg) => {
      if (msg.type === 'PING') {
        await peer.sendMessage({
          type: 'ACK',
          channelId: msg.channelId,
          nonce: msg.nonce,
          payload: { pong: true, via: 'relay' },
        });
      }
    });

    const peer = await b.connectToPeer(PUB_A, 's9-relay');
    const replyPromise = waitForMessage(peer, 's9-relay', 'ACK', 15_000);
    await peer.sendMessage({
      type: 'PING',
      channelId: 's9-relay',
      nonce: 1,
      payload: { hello: true },
    });
    const reply = await replyPromise;
    if (!reply.payload || reply.payload.pong !== true) {
      throw new Error(`unexpected ACK payload: ${JSON.stringify(reply.payload)}`);
    }
    log('round-trip', JSON.stringify(reply.payload));

    // Both clients should be registered on the relay.
    const clients = await waitFor('relay clients', 20, 100, () =>
      relay.clientCount >= 2 ? relay.clientCount : null,
    );

    const result = {
      stage: 'S9',
      at: new Date().toISOString(),
      transport: 'relay',
      relayUrl: url,
      relayPort: port,
      relayClients: clients,
      participants: { A: PUB_A, B: PUB_B },
      channelId: 's9-relay',
      pass: true,
    };
    console.log(`OMNIA_RESULT ${JSON.stringify(result)}`);
    console.log('S9_PASS');
  } finally {
    await a.close().catch(() => {});
    await b.close().catch(() => {});
    await relay.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(JSON_ONLY ? JSON.stringify({ stage: 'S9', pass: false, error: String(err) }) : err?.stack ?? err);
  console.error('S9_FAIL');
  process.exit(1);
});
