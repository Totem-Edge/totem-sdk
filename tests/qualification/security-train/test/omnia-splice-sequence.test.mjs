/**
 * RFC-078 — a splice successor must advance STATE(101), never reset it.
 *
 * A reset lets an old splice state be replayed against the current channel.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSpliceTx } from '../../../../packages/omnia-splice/dist/index.js';
import { initCoreWasm } from '../_shared/init-core-wasm.mjs';

await initCoreWasm();

const channel = {
  channelId: '0x' + 'aa'.repeat(32),
  fundingAddress: '0x' + 'bb'.repeat(32),
  fundingScript: 'RETURN TRUE',
  tokenId: '0x00',
  tokenScale: 0,
  totalValue: 1000n,
  currentSequence: 4,
  parties: [
    { partyId: 'alice', publicKeyDigest: '0x' + '11'.repeat(32), addressIndex: 0 },
    { partyId: 'bob', publicKeyDigest: '0x' + '22'.repeat(32), addressIndex: 1 },
  ],
  balances: { alice: 600n, bob: 400n },
  pendingHTLCs: [],
};

test('splice successor sequence advances past the current sequence', () => {
  const draft = buildSpliceTx(channel, {
    type: 'splice_in',
    newTotalValue: 1200n,
    newBalances: { alice: 700n, bob: 500n },
    additionalCoinId: '0x' + 'cc'.repeat(32),
    additionalAmount: 200n,
  });

  const sequence = draft.outputs[0].stateVarSequence;
  assert.ok(
    sequence > channel.currentSequence,
    `splice successor sequence ${sequence} did not advance past ${channel.currentSequence}`,
  );
});
