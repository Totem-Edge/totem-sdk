#!/usr/bin/env node
/**
 * S10 (host E2E) — liquidity-pool lifecycle through the omnia-host API.
 *
 *   create -> deposit -> allocate -> release -> withdraw -> approve -> payout
 *
 * Flags: --json
 */
import { createRequire } from 'node:module';
import os from 'node:os';

const require = createRequire(import.meta.url);
const host = require('../packages/omnia-host/dist/index.js');

const JSON_ONLY = process.argv.includes('--json');
const log = (...args) => { if (!JSON_ONLY) console.log(...args); };
const json = (value) => JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function main() {
  const config = host.loadConfigFromEnv({
    OMNIA_HOST_SEED: '0x' + 'ab'.repeat(32),
    OMNIA_HOST_DB: `${os.tmpdir()}/omnia-s10-host-${Date.now()}.sqlite`,
  });
  const signing = host.createHostSigning(config);
  const context = {
    channels: new Map(),
    pools: new Map(),
    poolPositions: new Map(),
    signer: signing.signer,
    leaseProvider: signing.leaseProvider,
    localParticipant: { partyId: 'operator', publicKeyDigest: signing.publicKeyDigest, addressIndex: 0 },
    chainProvider: {
      getCoin: async () => ({
        coinid: '0x' + '11'.repeat(32),
        amount: '100000',
        address: 'MxLP',
        tokenid: '0x00',
        spent: false,
      }),
    },
    custodyMode: 'self',
  };
  const methods = host.createHostMethods(context);

  await methods.get('omnia/createLiquidityPool')({
    poolId: 's10-host-pool',
    operatorAddress: 'MxOPERATOR',
    tokenId: '0x00',
    purpose: 'omnia-channel-capital',
    poolType: 'community-pool',
    capacity: '1000000',
    feePolicy: { feeModel: 'pro-rata', lpFeeBps: 50, operatorFeeBps: 10 },
  });
  const deposited = await methods.get('omnia/depositToPool')({
    poolId: 's10-host-pool',
    lpAddress: 'MxLP',
    amount: '100000',
    purpose: 'omnia-channel-capital',
    underlyingUtxoRef: '0x' + '11'.repeat(32),
  });
  assert(deposited.position.amount === '100000', 'deposit amount mismatch');
  const positionId = deposited.position.positionId;
  if (!JSON_ONLY) log('deposited', positionId, deposited.position.amount);

  const allocated = await methods.get('omnia/allocatePoolCapital')({
    positionId,
    amount: '50000',
    allocationType: 'manual-reserve',
    purpose: 'community-liquidity',
    target: { type: 'reserve', purpose: 'contingency' },
  });
  assert(allocated.position.allocatedAmount === '50000', 'allocation mismatch');
  await methods.get('omnia/releasePoolAllocation')({ positionId });

  const withdrawn = await methods.get('omnia/withdrawPool')({
    positionId, amount: '1000', recipientAddress: 'MxLP',
  });
  assert(withdrawn.intent, 'withdrawal intent missing');
  const approved = await methods.get('omnia/approvePoolWithdrawal')({ positionId });
  assert(approved.intent.status === 'approved', 'withdrawal not approved');

  const paid = await methods.get('omnia/executePoolPayout')({
    positionId,
    recipientAddress: 'MxLP',
    settlement: { status: 'confirmed', evidenceRef: 's10-host-indexer', txpowId: 'tx-s10-host' },
    signIndices: { addressIndex: 0, l1: 0, l2: 0 },
  });
  assert(paid.position.amount === '99000', `final amount ${paid.position.amount}`);
  assert(paid.signedTransition, 'payout was not rooted');

  const result = {
    stage: 'S10_HOST',
    at: new Date().toISOString(),
    poolId: 's10-host-pool',
    positionId,
    deposited: '100000',
    allocated: '50000',
    withdrawn: '1000',
    remaining: paid.position.amount,
    payoutStatus: paid.intent.status,
    rooted: Boolean(paid.signedTransition),
    pass: true,
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(json(result))}`);
  console.log('S10_HOST_PASS');
}

main().catch((err) => {
  console.error(JSON_ONLY ? JSON.stringify({ stage: 'S10_HOST', pass: false, error: String(err) }) : err?.stack ?? err);
  console.error('S10_HOST_FAIL');
  process.exit(1);
});
