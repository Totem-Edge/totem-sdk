#!/usr/bin/env node
/**
 * S6 — virtual-UTXO claims (SDK harness).
 *
 *   create pool -> mint -> co-sign/verify receipt -> partial transfer ->
 *   co-sign/verify receipt -> refresh -> exit draft -> exited
 *
 * Uses the real `@totemsdk/omnia-vtxo` primitives with a real unified TreeKey
 * operator signature and an in-memory lease provider. No node, chain, or cloud
 * host is required.
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
const vtxo = require('../packages/omnia-vtxo/dist/cjs/index.js');

const JSON_ONLY = process.argv.includes('--json');
const log = (...args) => { if (!JSON_ONLY) console.log(...args); };

const T0 = 1_700_000_000_000;
const POOL_CAPACITY = 1_000_000n;
const MINT_AMOUNT = 100_000n;
const TRANSFER_AMOUNT = 40_000n;
const ALICE = 'MxS6ALICE';
const BOB = 'MxS6BOB';

function jsonBig(value) {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mockLease() {
  let counter = 0;
  return {
    reserveKeyUse: async () => ({
      reservationId: `s6-lease-${++counter}`,
      indices: { addressIndex: 0, l1: 0, l2: counter - 1 },
      expiresAt: T0 + 3_600_000,
    }),
    commitKeyUse: async () => {},
    burnReservation: async () => {},
  };
}

async function signAndVerify(operator, receipt, batch, root) {
  const signed = await vtxo.signVtxoReceipt(operator, receipt, batch);
  assert(await vtxo.verifyVtxoReceipt(operator, signed, root), `receipt ${receipt.receiptId} did not verify`);
  return signed;
}

async function main() {
  const treeKey = core.createUnifiedChildTreeKey(new Uint8Array(32).fill(7), 0);
  const operator = vtxo.createVtxoOperator({
    poolId: 's6-pool',
    treeKey,
    leaseProvider: mockLease(),
  });

  const pool = vtxo.createPool(
    {
      operator: operator.publicKey,
      tokenId: '0x00',
      totalCapacity: POOL_CAPACITY,
      nonce: 's6-pool',
    },
    T0,
  );

  const minted = vtxo.mintVtxo(pool, { owner: ALICE, amount: MINT_AMOUNT, nonce: 'mint-1' }, T0 + 1);
  const mintRoot = minted.vtxo.proof.root;
  const mintReceipt = await signAndVerify(
    operator,
    minted.receipt,
    { outputs: [minted.vtxo], root: mintRoot, epoch: minted.vtxo.epoch },
    mintRoot,
  );
  log('minted', minted.vtxo.vtxoId, minted.vtxo.amount.toString());

  const transfer = vtxo.transferVtxo(
    minted.vtxo,
    { recipient: BOB, amount: TRANSFER_AMOUNT, nonce: 'xfer-1' },
    T0 + 2,
  );
  assert(transfer.output.amount === TRANSFER_AMOUNT, 'transfer output amount mismatch');
  assert(transfer.change && transfer.change.amount === MINT_AMOUNT - TRANSFER_AMOUNT, 'change amount mismatch');
  assert(transfer.input.status === 'split', `input status ${transfer.input.status}`);

  const transferOutputs = [transfer.output, transfer.change];
  const transferRoot = transfer.output.proof.root;
  const transferReceipt = await signAndVerify(
    operator,
    transfer.receipt,
    {
      outputs: transferOutputs,
      root: transferRoot,
      epoch: transfer.output.epoch,
      inputsAmount: MINT_AMOUNT,
    },
    transferRoot,
  );
  log('transferred', transfer.output.vtxoId, transfer.change.vtxoId);

  const refreshed = vtxo.refreshVtxo(
    transfer.output,
    { newEpoch: 1, nonce: 'refresh-1' },
    T0 + 3,
  );
  const refreshRoot = refreshed.refreshed.proof.root;
  const refreshReceipt = await signAndVerify(
    operator,
    refreshed.receipt,
    { outputs: [refreshed.refreshed], root: refreshRoot, epoch: 1, previousEpoch: 0 },
    refreshRoot,
  );
  log('refreshed', refreshed.refreshed.vtxoId, 'epoch', refreshed.refreshed.epoch);

  const exit = vtxo.createExitDraft(refreshed.refreshed, T0 + 4);
  assert(exit.draft.amount === TRANSFER_AMOUNT, 'exit draft amount mismatch');
  assert(exit.draft.verifiedShare === exit.draft.amount, 'exit verified share mismatch');
  const exitReceipt = await signAndVerify(
    operator,
    exit.receipt,
    { outputs: [refreshed.refreshed], root: refreshRoot, epoch: refreshed.refreshed.epoch, previousEpoch: 0 },
    refreshRoot,
  );
  const exiting = vtxo.markExiting(refreshed.refreshed, T0 + 5);
  const exited = vtxo.markExited(exiting, { txpowId: 'tx-s6-exit', now: T0 + 6 });
  assert(exited.status === 'exited', `exit status ${exited.status}`);

  // Negative: a receipt must not verify against a different root.
  const badRoot = '0x' + 'ff'.repeat(32);
  assert(!(await vtxo.verifyVtxoReceipt(operator, mintReceipt, badRoot)), 'receipt verified against wrong root');

  const result = {
    stage: 'S6',
    at: new Date().toISOString(),
    poolId: pool.poolId,
    operator: operator.publicKey,
    minted: { vtxoId: minted.vtxo.vtxoId, amount: minted.vtxo.amount.toString(), receiptId: mintReceipt.receiptId },
    transfer: {
      outputId: transfer.output.vtxoId,
      changeId: transfer.change.vtxoId,
      amount: transfer.output.amount.toString(),
      changeAmount: transfer.change.amount.toString(),
      receiptId: transferReceipt.receiptId,
    },
    refreshed: { vtxoId: refreshed.refreshed.vtxoId, epoch: refreshed.refreshed.epoch, receiptId: refreshReceipt.receiptId },
    exit: { draftAmount: exit.draft.amount.toString(), receiptId: exitReceipt.receiptId, status: exited.status },
    pass: true,
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(jsonBig(result))}`);
  console.log('S6_PASS');
}

main().catch((err) => {
  console.error(JSON_ONLY ? JSON.stringify({ stage: 'S6', pass: false, error: String(err) }) : err?.stack ?? err);
  console.error('S6_FAIL');
  process.exit(1);
});
