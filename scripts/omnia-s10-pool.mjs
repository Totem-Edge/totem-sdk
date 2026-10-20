#!/usr/bin/env node
/**
 * S10 — liquidity-pool lifecycle (SDK harness).
 *
 *   create pool -> deposit -> allocate -> release -> withdraw -> payout
 *
 * Uses the real `@totemsdk/omnia-pool` accounting with an in-memory registry and
 * deterministic funding verification; no node, chain, or cloud host is required.
 *
 * Flags:
 *   --json        only print the final result JSON
 *
 * Result: prints an `OMNIA_RESULT {...}` line; use it to update
 * docs/OMNIA_TEST_RESULTS.md.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const liquidityBond = require('../packages/liquidity-bond/dist/cjs/index.js');
const pool = require('../packages/omnia-pool/dist/cjs/index.js');

const JSON_ONLY = process.argv.includes('--json');
const log = (...args) => { if (!JSON_ONLY) console.log(...args); };

const POOL_ID = 's10-pool';
const LP = 'MxS10LP';
const OPERATOR = 'MxS10OPERATOR';
const TOKEN = '0x00';
const DEPOSIT = '100000';
const ALLOCATION = '50000';
const WITHDRAW = '1000';

function jsonBig(value) {
  return JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const registry0 = liquidityBond.createEmptyLiquidityBondRegistryState();
  const created = pool.createOmniaPool(
    {
      poolId: POOL_ID,
      operatorAddress: OPERATOR,
      tokenId: TOKEN,
      purpose: 'omnia-channel-capital',
      poolType: 'community-pool',
      capacity: '1000000',
      feePolicy: { feeModel: 'pro-rata', lpFeeBps: 50, operatorFeeBps: 10 },
    },
    registry0,
  );

  const deposited = await pool.depositToPool(
    {
      pool: created.manifest,
      lpAddress: LP,
      amount: DEPOSIT,
      purpose: 'omnia-channel-capital',
      underlyingUtxoRef: '0x' + '11'.repeat(32),
      chainProvider: { verifyDeposit: async () => ({ valid: true }) },
    },
    created.registry,
  );
  assert(deposited.position.amount === BigInt(DEPOSIT), 'deposit amount mismatch');
  assert(deposited.receipt.ownerAddress === LP, 'receipt owner mismatch');
  log('deposited', deposited.position.positionId, deposited.position.amount.toString());

  const allocated = await pool.allocatePositionCapital(
    {
      position: deposited.position,
      amount: ALLOCATION,
      allocationType: 'manual-reserve',
      purpose: 'community-liquidity',
      target: { type: 'reserve', purpose: 'contingency' },
    },
    deposited.state,
  );
  assert(allocated.position.allocatedAmount === BigInt(ALLOCATION), 'allocated amount mismatch');
  assert(allocated.position.availableAmount === BigInt(DEPOSIT) - BigInt(ALLOCATION), 'available amount mismatch');
  const navAllocated = pool.computePoolNAV(created.manifest, allocated.registry);
  assert(navAllocated.totalCommitted === BigInt(DEPOSIT), 'NAV committed mismatch');
  assert(navAllocated.totalAllocated === BigInt(ALLOCATION), 'NAV allocated mismatch');
  log('allocated', allocated.allocation.allocationId, allocated.position.availableAmount.toString());

  const released = pool.releaseAllocation(
    { allocation: allocated.allocation, position: allocated.position },
    allocated.registry,
  );
  assert(released.position.allocatedAmount === 0n, 'release left capital allocated');
  assert(released.position.availableAmount === BigInt(DEPOSIT), 'release did not restore capital');

  const withdrawn = pool.withdrawLiquidity(
    created.manifest,
    released.position,
    { positionId: released.position.positionId, amount: WITHDRAW, recipientAddress: LP },
    released.registry,
  );
  const approved = pool.approveWithdrawal(withdrawn.intent, released.position, withdrawn.state);
  const signer = {
    publicKeyDigest: 's10-rooter',
    sign: async () => new Uint8Array([7, 8, 9]),
  };
  const payout = await pool.executePoolPayout(
    {
      pool: created.manifest,
      position: released.position,
      intent: approved.intent,
      recipientAddress: LP,
      settlement: { status: 'confirmed', evidenceRef: 's10-indexer', txpowId: 'tx-s10' },
      rooting: { signer, signIndices: { addressIndex: 0, l1: 0, l2: 1 } },
    },
    approved.registry,
  );
  assert(payout.intent.status === 'settled-externally', `payout status ${payout.intent.status}`);
  assert(payout.position.amount === BigInt(DEPOSIT) - BigInt(WITHDRAW), 'withdrawn amount mismatch');
  assert(payout.signedTransition, 'payout was not rooted');

  const navFinal = pool.computePoolNAV(created.manifest, payout.registry);
  assert(navFinal.totalCommitted === BigInt(DEPOSIT) - BigInt(WITHDRAW), 'final NAV mismatch');

  const result = {
    stage: 'S10',
    at: new Date().toISOString(),
    poolId: POOL_ID,
    positionId: deposited.position.positionId,
    receiptId: deposited.receipt.receiptId,
    deposited: DEPOSIT,
    allocated: ALLOCATION,
    withdrawn: WITHDRAW,
    remaining: payout.position.amount.toString(),
    nav: navFinal.nav.toString(),
    payoutStatus: payout.intent.status,
    rooted: Boolean(payout.signedTransition),
    pass: true,
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(jsonBig(result))}`);
  console.log('S10_PASS');
}

main().catch((err) => {
  console.error(JSON_ONLY ? JSON.stringify({ stage: 'S10', pass: false, error: String(err) }) : err?.stack ?? err);
  console.error('S10_FAIL');
  process.exit(1);
});
