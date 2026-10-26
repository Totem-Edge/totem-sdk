#!/usr/bin/env node
/**
 * S6 (host E2E) — VTXO lifecycle through the omnia-host API.
 *
 *   create pool -> mint -> sign receipt -> partial transfer -> refresh ->
 *   exit draft -> exited
 *
 * Flags: --json
 */
import { createRequire } from 'node:module';
import os from 'node:os';

const require = createRequire(import.meta.url);
const host = require('../packages/omnia-host/dist/index.js');

const JSON_ONLY = process.argv.includes('--json');
const log = (...args) => { if (!JSON_ONLY) console.log(...args); };
const hex = (u8) => '0x' + Buffer.from(u8).toString('hex');
const json = (value) => JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function main() {
  const config = host.loadConfigFromEnv({
    OMNIA_HOST_SEED: '0x' + 'ab'.repeat(32),
    OMNIA_HOST_DB: `${os.tmpdir()}/omnia-s6-host-${Date.now()}.sqlite`,
  });
  const signing = host.createHostSigning(config);
  const context = {
    channels: new Map(),
    vtxoPools: new Map(),
    vtxos: new Map(),
    vtxoReceipts: new Map(),
    preparedVtxoReceipts: new Map(),
    coordinator: true,
    localParticipant: { partyId: 'operator', publicKeyDigest: signing.publicKeyDigest, addressIndex: 0 },
    custodyMode: 'self',
  };
  const methods = host.createHostMethods(context);

  const signReceipt = async (receiptId, root, extra = {}) => {
    const prepared = await methods.get('omnia/prepareVtxoReceipt')({ receiptId, root, epoch: 0, ...extra });
    const request = prepared.requests.receipt;
    const signature = await signing.signer.sign(request.digest, { addressIndex: 0, l1: 0, l2: 0 });
    const submitted = await methods.get('omnia/submitVtxoReceipt')({ receiptId, signature: hex(signature) });
    assert(submitted.success && submitted.receipt.signature, 'receipt did not sign');
    return submitted.receipt;
  };

  const created = await methods.get('omnia/createVtxoPool')({
    poolId: 's6-host-pool', tokenId: '0x00', totalCapacity: '1000000', nonce: 's6-host',
  });
  if (!JSON_ONLY) log('pool', created.pool.poolId);

  const minted = await methods.get('omnia/mintVtxo')({
    poolId: created.pool.poolId, owner: 'alice', amount: '100000', nonce: 'mint-1',
  });
  const mintReceipt = await signReceipt(minted.receipt.receiptId, minted.vtxo.proof.root);
  if (!JSON_ONLY) log('minted', minted.vtxo.vtxoId);

  const transferred = await methods.get('omnia/transferVtxo')({
    vtxoId: minted.vtxo.vtxoId, recipient: 'bob', amount: '40000', nonce: 'xfer-1', unsafeLedgerTransfer: true,
  });
  const transferReceipt = await signReceipt(transferred.receipt.receiptId, transferred.output.proof.root, {
    inputsAmount: '100000',
  });
  if (!JSON_ONLY) log('transferred', transferred.output.vtxoId, transferred.change.vtxoId);

  const refreshed = await methods.get('omnia/refreshVtxo')({
    vtxoId: transferred.output.vtxoId, newEpoch: 1, nonce: 'refresh-1',
  });
  const refreshPrepared = await methods.get('omnia/prepareVtxoReceipt')({
    receiptId: refreshed.receipt.receiptId,
    root: refreshed.refreshed.proof.root,
    epoch: 1,
    previousEpoch: 0,
    inputsAmount: '40000',
  });
  const refreshSignature = await signing.signer.sign(refreshPrepared.requests.receipt.digest, { addressIndex: 0, l1: 0, l2: 0 });
  const refreshReceipt = await methods.get('omnia/submitVtxoReceipt')({
    receiptId: refreshed.receipt.receiptId, signature: hex(refreshSignature),
  });
  assert(refreshReceipt.success, 'refresh receipt did not sign');

  const exit = await methods.get('omnia/initiateVtxoExit')({ vtxoId: refreshed.refreshed.vtxoId });
  assert(exit.vtxo.status === 'exiting', 'exit not initiated');
  const exited = await methods.get('omnia/completeVtxoExit')({
    vtxoId: refreshed.refreshed.vtxoId, txpowId: 'tx-s6-host-exit',
  });
  assert(exited.vtxo.status === 'exited', 'exit not completed');

  const result = {
    stage: 'S6_HOST',
    at: new Date().toISOString(),
    poolId: created.pool.poolId,
    minted: { vtxoId: minted.vtxo.vtxoId, receiptId: mintReceipt.receiptId },
    transfer: { outputId: transferred.output.vtxoId, changeId: transferred.change.vtxoId, receiptId: transferReceipt.receiptId },
    refreshed: { vtxoId: refreshed.refreshed.vtxoId, epoch: refreshed.refreshed.epoch },
    exit: { status: exited.vtxo.status },
    pass: true,
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(json(result))}`);
  console.log('S6_HOST_PASS');
}

main().catch((err) => {
  console.error(JSON_ONLY ? JSON.stringify({ stage: 'S6_HOST', pass: false, error: String(err) }) : err?.stack ?? err);
  console.error('S6_HOST_FAIL');
  process.exit(1);
});
