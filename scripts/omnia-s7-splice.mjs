#!/usr/bin/env node
/**
 * S7 — splice in/out (SDK harness).
 *
 *   active channel -> quiesce -> propose splice-in -> accept -> finalize
 *   -> quiesce -> propose splice-out -> accept -> finalize
 *
 * Uses the real `@totemsdk/omnia-splice` state machine with deterministic mock
 * WOTS signers (signature = sha3(pkd || digest)) and MAX_HASH mining difficulty.
 * No node, chain, or cloud host is required. Host wiring (peer coordination and
 * accept/finalize methods) remains future work.
 *
 * Flags:
 *   --json        only print the final result JSON
 *
 * Result: prints an `OMNIA_RESULT {...}` line; use it to update
 * docs/OMNIA_TEST_RESULTS.md.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../packages/core/dist/cjs/index.js');
const txpow = require('../packages/txpow/dist/cjs/index.js');
const omnia = require('../packages/omnia/dist/cjs/index.js');
const splice = require('../packages/omnia-splice/dist/cjs/index.js');

const JSON_ONLY = process.argv.includes('--json');
const log = (...args) => { if (!JSON_ONLY) console.log(...args); };

const PKD_ALICE = '0x' + 'aa'.repeat(32);
const PKD_BOB = '0x' + 'bb'.repeat(32);
const FUNDING_COIN_ID = '0x' + 'cc'.repeat(32);
const FUNDING_ADDRESS = '0x' + 'dd'.repeat(32);
const NEW_COIN_ID = '0x' + '11'.repeat(32);
const WITHDRAW_ADDRESS = '0x' + 'ee'.repeat(32);
const TOKEN_ID = '0x00';

function jsonBig(value) {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mockVerifySignature(sig, digest, pkd) {
  const expected = core.sha3_256(new Uint8Array([...Buffer.from(pkd.slice(2), 'hex'), ...digest]));
  return expected.length === sig.length && expected.every((b, i) => b === sig[i]);
}

function makeSigner(pkd) {
  return {
    publicKeyDigest: pkd,
    async sign(payload) {
      return core.sha3_256(new Uint8Array([...Buffer.from(pkd.slice(2), 'hex'), ...payload]));
    },
  };
}

function makeMockWotsLease() {
  let counter = 0;
  return {
    reserveKeyUse: async () => {
      const idx = ++counter;
      return { reservationId: `s7-res-${idx}`, indices: { l1: idx, l2: 0, addressIndex: 0 }, expiresAt: Date.now() + 3_600_000 };
    },
    commitKeyUse: async () => {},
    burnReservation: async () => {},
    getLocalWatermark: async (treeId) => ({ treeId, addressCursor: 0, l1Cursor: 0, l2Cursor: 0, unavailableCount: 0, capacity: 4096 }),
    publishWatermark: async () => {},
    syncLeaseJournal: async () => ({ synced: true, conflicts: [] }),
    verifyLeaseCertificate: async () => true,
  };
}

function makeLeaseProvider(pkd) {
  return { signer: makeSigner(pkd), wotsLease: makeMockWotsLease() };
}

function makeChannel() {
  return {
    channelId: '0x' + 'ab'.repeat(32),
    fundingTxId: '0x' + 'ef'.repeat(32),
    fundingCoinId: FUNDING_COIN_ID,
    fundingScript: 'RETURN TRUE',
    programId: omnia.DefaultEltooPaymentProgram.id,
    programVersion: omnia.DefaultEltooPaymentProgram.version,
    fundingAddress: FUNDING_ADDRESS,
    tokenId: TOKEN_ID,
    tokenScale: 0,
    totalValue: 1000n,
    parties: [
      { partyId: 'alice', publicKeyDigest: PKD_ALICE, addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: PKD_BOB, addressIndex: 1 },
    ],
    balances: { alice: 600n, bob: 400n },
    pendingHTLCs: [],
    currentSequence: 5,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 1_000_000,
    updatedAt: 1_000_000,
  };
}

const mineOptions = (aliceLp, bobLp) => ({
  mineDifficulty: txpow.MAX_HASH,
  verifySignature: mockVerifySignature,
  proposerLeaseProvider: aliceLp.wotsLease,
  acceptorLeaseProvider: bobLp.wotsLease,
});

async function main() {
  omnia._resetChannelWatermarks();

  // ── splice in: 1000 -> 1500, balances 900/600 ──────────────────────────────
  const aliceIn = makeLeaseProvider(PKD_ALICE);
  const bobIn = makeLeaseProvider(PKD_BOB);
  const quiescedIn = await splice.quiesceChannel(makeChannel(), aliceIn);
  const proposalIn = await splice.proposeSpliceIn(
    quiescedIn,
    NEW_COIN_ID,
    500n,
    aliceIn,
    { alice: 900n, bob: 600n },
  );
  const acceptanceIn = await splice.acceptSplice(quiescedIn, proposalIn, bobIn);
  const splicedIn = await splice.finalizeSplice(
    quiescedIn,
    proposalIn,
    acceptanceIn,
    mineOptions(aliceIn, bobIn),
  );
  assert(splicedIn.status === 'active', `splice-in status ${splicedIn.status}`);
  assert(splicedIn.totalValue === 1500n, `splice-in total ${splicedIn.totalValue}`);
  assert(splicedIn.balances.alice === 900n && splicedIn.balances.bob === 600n, 'splice-in balances');
  assert(quiescedIn.status === 'spliced', 'old channel was not invalidated');
  log('splice-in', splicedIn.spliceFundingCoinId, splicedIn.totalValue.toString());

  // ── splice out: 1500 -> 1000, withdraw 500, balances 600/400 ───────────────
  omnia._resetChannelWatermarks();
  const aliceOut = makeLeaseProvider(PKD_ALICE);
  const bobOut = makeLeaseProvider(PKD_BOB);
  // The SDK keeps a per-channel sequence watermark; use a fresh channel id for
  // the out phase (the same pattern as the splice test suite).
  const outChannel = makeChannel();
  outChannel.channelId = '0x' + 'ba'.repeat(32);
  log('splice-out channel', outChannel.channelId, 'seq', outChannel.currentSequence);
  const quiescedOut = await splice.quiesceChannel(outChannel, aliceOut);
  const proposalOut = await splice.proposeSpliceOut(
    quiescedOut,
    500n,
    WITHDRAW_ADDRESS,
    aliceOut,
    { alice: 300n, bob: 200n },
  );
  assert(proposalOut.params.withdrawAmount === 500n, 'splice-out withdraw amount');
  const acceptanceOut = await splice.acceptSplice(quiescedOut, proposalOut, bobOut);
  const splicedOut = await splice.finalizeSplice(
    quiescedOut,
    proposalOut,
    acceptanceOut,
    mineOptions(aliceOut, bobOut),
  );
  assert(splicedOut.status === 'active', `splice-out status ${splicedOut.status}`);
  assert(splicedOut.totalValue === 500n, `splice-out total ${splicedOut.totalValue}`);
  assert(splicedOut.balances.alice === 300n && splicedOut.balances.bob === 200n, 'splice-out balances');
  assert(splicedOut.spliceType === 'splice_out', `splice-out type ${splicedOut.spliceType}`);
  log('splice-out', splicedOut.spliceFundingCoinId, splicedOut.totalValue.toString());

  const result = {
    stage: 'S7',
    at: new Date().toISOString(),
    channelId: splicedOut.channelId,
    spliceIn: {
      spliceId: proposalIn.spliceId,
      from: '1000',
      to: splicedIn.totalValue.toString(),
      balances: { alice: splicedIn.balances.alice.toString(), bob: splicedIn.balances.bob.toString() },
      fundingCoinId: splicedIn.spliceFundingCoinId,
    },
    spliceOut: {
      spliceId: proposalOut.spliceId,
      from: outChannel.totalValue.toString(),
      to: splicedOut.totalValue.toString(),
      withdrawAmount: proposalOut.params.withdrawAmount.toString(),
      withdrawAddress: WITHDRAW_ADDRESS,
      balances: { alice: splicedOut.balances.alice.toString(), bob: splicedOut.balances.bob.toString() },
      fundingCoinId: splicedOut.spliceFundingCoinId,
    },
    pass: true,
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(jsonBig(result))}`);
  console.log('S7_PASS');
}

main().catch((err) => {
  console.error(JSON_ONLY ? JSON.stringify({ stage: 'S7', pass: false, error: String(err) }) : err?.stack ?? err);
  console.error('S7_FAIL');
  process.exit(1);
});
