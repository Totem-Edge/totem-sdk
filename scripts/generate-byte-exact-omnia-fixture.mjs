#!/usr/bin/env node
/**
 * Generate a byte-exact Omnia channel fixture from the real SDK primitives.
 *
 * This is deliberately not a synthetic observation source: it creates real
 * update/settlement transaction drafts and real WOTS signatures with fixed
 * seeds, then serializes them with the same tx-builder used on the wire.
 * The fixed seeds/indices and fixed channel metadata make the output stable.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const omnia = require('../packages/omnia/dist/cjs/index.js');
const { createHostSigning } = require('../packages/omnia-host/dist/signing.js');
const { loadConfigFromEnv } = require('../packages/omnia-host/dist/config.js');
const { bytesToHex, computeScriptAddress, scriptFromWotsPk } = require('../packages/core/dist/cjs/index.js');

const SEED_A = '0x' + 'a1'.repeat(32);
const SEED_B = '0x' + 'b2'.repeat(32);
const CREATED_AT = 1_700_000_000_000;

function signing(seed, name, dir) {
  return createHostSigning(loadConfigFromEnv({
    OMNIA_HOST_SEED: seed,
    OMNIA_HOST_DB: path.join(dir, `${name}.sqlite`),
  }));
}

async function build(dir) {
  const a = signing(SEED_A, 'alice', dir);
  const b = signing(SEED_B, 'bob', dir);

  const settlementAddress = (s) => computeScriptAddress(scriptFromWotsPk(s.treeKey.getPublicKey()));
  const parties = [
    { partyId: 'alice', publicKeyDigest: a.publicKeyDigest, addressIndex: 0, settlementAddress: settlementAddress(a) },
    { partyId: 'bob', publicKeyDigest: b.publicKeyDigest, addressIndex: 0, settlementAddress: settlementAddress(b) },
  ];
  const { script, address } = omnia.buildAndHashEltooScript(parties);

  const channel = {
    channelId: '0x' + '11'.repeat(32),
    fundingTxId: '0x' + '22'.repeat(32),
    fundingCoinId: '0x' + '33'.repeat(32),
    fundingScript: script,
    fundingAddress: address,
    programId: 'eltoo-payment',
    programVersion: 1,
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1000n,
    parties,
    balances: { alice: 600n, bob: 400n },
    pendingHTLCs: [],
    currentSequence: 0,
    latestState: null,
    stateLog: [{ sequence: 0, timestamp: CREATED_AT, balances: { alice: 600n, bob: 400n }, htlcCount: 0, event: 'open' }],
    status: 'active',
    channelType: 'direct',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };

  const updated = await omnia.updateState(
    channel,
    { newBalances: { alice: 550n, bob: 450n } },
    a.leaseProvider,
    a.signer,
  );
  if (updated.error) throw new Error(updated.error);

  const bobPartial = await omnia.signState(
    channel,
    { newSequence: updated.signedState.sequence, newBalances: updated.signedState.balances },
    b.leaseProvider,
    b.signer,
  );
  const signed = omnia.attachCounterpartySignature(
    updated.channel,
    updated.signedState,
    'bob',
    bobPartial.signatures.bob,
    bobPartial.signingIndices.bob,
    bobPartial.closePackage,
  );

  const updateDraft = omnia.deserializeTxDraft(signed.signedState.transactionHex);
  const updateDigest = omnia.computeOmniaTxDigest(updateDraft);
  const aliceUpdateOk = omnia.verifyChannelSignature(signed.signedState.signatures.alice, updateDigest, a.publicKeyDigest);
  const bobUpdateOk = omnia.verifyChannelSignature(signed.signedState.signatures.bob, updateDigest, b.publicKeyDigest);
  if (!aliceUpdateOk || !bobUpdateOk) throw new Error('update signature verification failed');

  const settledChannel = {
    ...signed.channel,
    latestState: signed.signedState,
    balances: signed.signedState.balances,
    currentSequence: signed.signedState.sequence,
  };
  const settlement = omnia.buildSettlementSigningRequest(settledChannel, {
    partyAddresses: { alice: settlementAddress(a), bob: settlementAddress(b) },
  });
  const settlementDigest = Uint8Array.from(Buffer.from(settlement.digestHex.replace(/^0x/i, ''), 'hex'));
  const aliceSettlement = await omnia.signSettlementRequest(
    settledChannel, settlement, a.leaseProvider, a.signer,
  );
  const bobSettlement = await omnia.signSettlementRequest(
    settledChannel, settlement, b.leaseProvider, b.signer,
  );
  if (!omnia.verifyChannelSignature(aliceSettlement.signature, settlementDigest, a.publicKeyDigest)) {
    throw new Error('alice settlement signature verification failed');
  }
  if (!omnia.verifyChannelSignature(bobSettlement.signature, settlementDigest, b.publicKeyDigest)) {
    throw new Error('bob settlement signature verification failed');
  }

  return {
    schemaVersion: 1,
    generator: 'sdk-primitives',
    byteExact: true,
    networkId: 'byte-exact-s4',
    createdAt: CREATED_AT,
    channel: {
      channelId: channel.channelId,
      fundingTxId: channel.fundingTxId,
      fundingCoinId: channel.fundingCoinId,
      fundingScript: script,
      fundingAddress: address,
      totalValue: channel.totalValue.toString(),
      balances: Object.fromEntries(Object.entries(channel.balances).map(([k, v]) => [k, v.toString()])),
      tokenId: channel.tokenId,
      parties: parties.map((p) => ({
        partyId: p.partyId,
        publicKeyDigest: p.publicKeyDigest,
        settlementAddress: p.settlementAddress,
      })),
    },
    update: {
      sequence: signed.signedState.sequence,
      balances: Object.fromEntries(Object.entries(signed.signedState.balances).map(([k, v]) => [k, v.toString()])),
      transactionHex: signed.signedState.transactionHex,
      digestHex: '0x' + bytesToHex(updateDigest),
      signatures: {
        alice: '0x' + bytesToHex(signed.signedState.signatures.alice),
        bob: '0x' + bytesToHex(signed.signedState.signatures.bob),
      },
      signingIndices: signed.signedState.signingIndices,
    },
    settlement: {
      settlementTxHex: settlement.settlementTxHex,
      digestHex: settlement.digestHex,
      partyAddresses: settlement.partyAddresses,
      signatures: {
        alice: { signature: '0x' + bytesToHex(aliceSettlement.signature), indices: aliceSettlement.indices },
        bob: { signature: '0x' + bytesToHex(bobSettlement.signature), indices: bobSettlement.indices },
      },
    },
  };
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-byte-exact-'));
const fixture = await build(dir);
const out = process.argv[2];
if (out) {
  fs.writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n');
  console.log(`wrote ${out}`);
} else {
  process.stdout.write(JSON.stringify(fixture));
}
