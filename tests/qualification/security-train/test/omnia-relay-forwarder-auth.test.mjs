/**
 * RFC-078 — a multi-hop forwarder must refuse to lock outgoing liquidity
 * unless the incoming HTLC exists in a tracked channel.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMultiHopForwarder } from '../../../../packages/omnia-relay/dist/index.js';

function forwarder() {
  return createMultiHopForwarder({
    channels: new Map(),
    leaseProvider: {},
    signer: {
      publicKeyDigest: '0x' + '11'.repeat(32),
      sign: async () => new Uint8Array(64),
    },
    swarm: {},
    linkJournal: {
      get: () => undefined,
      record: () => undefined,
      remove: () => undefined,
    },
  });
}

test('forwarding rejects an unknown incoming channel', async () => {
  await assert.rejects(
    forwarder().forwardIncoming({
      inChannelId: 'missing-channel',
      inHtlcId: 'missing-htlc',
      hashlock: '0x' + '22'.repeat(32),
      envelope: '[]',
      timeoutBlock: 100n,
    }),
    /incoming channel/,
  );
});
