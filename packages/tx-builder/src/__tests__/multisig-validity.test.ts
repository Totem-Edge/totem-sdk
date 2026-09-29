import { sha3_256, hexToBytes, bytesToHex, wotsKeypairFromSeed, wotsSign } from '@totemsdk/core';
import { MemoryStore } from '@totemsdk/storage';
import { MultisigManager, type MultisigConfig } from '../multisig-manager.js';
import { CoinSelectionService, CoinSelectionError } from '../coin-selection.js';

const OWN_PK = '0x' + 'aa'.repeat(32);
const OTHER_PK = '0x' + 'cc'.repeat(32);
const MOCK_SIG = '0x' + 'de'.repeat(1088);
const TX_HEX = '0x' + '01'.repeat(64);
const DIGEST = '0x' + bytesToHex(sha3_256(hexToBytes(TX_HEX)));

function makeConfig(overrides: Partial<MultisigConfig> = {}): MultisigConfig {
  return { type: '2of2', threshold: 2, publicKeys: [OWN_PK, OTHER_PK], ownPublicKey: OWN_PK, ...overrides };
}

describe('RFC-016 P5: tx-builder multisig validity', () => {
  it('an invalid signature never counts toward readiness', async () => {
    const mgr = new MultisigManager(new MemoryStore());
    const tx = await mgr.createPendingTransaction(makeConfig(), TX_HEX, DIGEST);
    await mgr.addOwnSignature(tx.id, MOCK_SIG); // invalid WOTS signature
    expect(await mgr.isReady(tx.id)).toBe(false);
    const reloaded = await mgr.getTransaction(tx.id);
    expect(reloaded?.status).toBe('pending');
  });

  it('rejects a digest that does not match the transaction hex', async () => {
    const mgr = new MultisigManager(new MemoryStore());
    await expect(
      mgr.createPendingTransaction(makeConfig(), TX_HEX, '0x' + 'ff'.repeat(32)),
    ).rejects.toThrow(/does not match/i);
  });
});

describe('RFC-018 P1-4: multisig config validation', () => {
  it('rejects duplicate public keys (collapse risk)', () => {
    const mgr = new MultisigManager();
    expect(() => mgr.createMultisigScript(makeConfig({ publicKeys: [OWN_PK, OWN_PK] }))).toThrow(
      /distinct/,
    );
  });

  it('rejects an out-of-range threshold', () => {
    const mgr = new MultisigManager();
    expect(() =>
      mgr.createMultisigScript(makeConfig({ type: 'mofn', threshold: 0, publicKeys: [OWN_PK, OTHER_PK] })),
    ).toThrow(/threshold/);
    expect(() =>
      mgr.createMultisigScript(makeConfig({ type: 'mofn', threshold: 3, publicKeys: [OWN_PK, OTHER_PK] })),
    ).toThrow(/threshold/);
  });

  it('rejects an ownPublicKey that is not a configured signer', () => {
    const mgr = new MultisigManager();
    expect(() => mgr.createMultisigScript(makeConfig({ ownPublicKey: '0x' + 'ee'.repeat(32) }))).toThrow(
      /ownPublicKey/,
    );
  });

  it('never trusts a persisted validated flag (re-verifies on load)', async () => {
    const store = new MemoryStore();
    const mgr = new MultisigManager(store);
    const tx = await mgr.createPendingTransaction(makeConfig(), TX_HEX, DIGEST);
    await mgr.addOwnSignature(tx.id, MOCK_SIG); // invalid

    // Tamper: flip the stored `validated` flag to true.
    const record = (await store.get('totem_pending_multisig')) as { transactions: Array<{ signatures: Record<string, { validated: boolean }> }> };
    for (const s of Object.values(record.transactions[0].signatures)) s.validated = true;
    await store.set('totem_pending_multisig', record);

    const reloaded = new MultisigManager(store);
    await reloaded.ready;
    expect(await reloaded.isReady(tx.id)).toBe(false);
  });

  it('does not clobber a terminal status', async () => {
    const mgr = new MultisigManager();
    const tx = await mgr.createPendingTransaction(makeConfig(), TX_HEX, DIGEST);
    await mgr.markBroadcast(tx.id);
    expect(await mgr.isReady(tx.id)).toBe(false);
    const status = await mgr.getSignatureStatus(tx.id);
    expect(status.status).toBe('broadcast');
  });
});

describe('RFC-016 P5: coin selection rejects non-positive targets', () => {
  it('throws INVALID_TARGET for a negative target instead of reporting success', () => {
    const service = new CoinSelectionService({ fetchSpendableCoins: async () => [] } as never);
    expect(() =>
      service.selectCoins([], { mode: 'global', targetAmount: '-1' }),
    ).toThrow(CoinSelectionError);
  });
});

// ─── RFC-020 TXB-MULTISIG-005/006: load binding + digest rebind ──────────────

const OWN_SEED = new Uint8Array(32).fill(1);
const OTHER_SEED = new Uint8Array(32).fill(2);
const ATTACKER_SEED = new Uint8Array(32).fill(9);
const OWN_PK_REAL = '0x' + bytesToHex(wotsKeypairFromSeed(OWN_SEED, 0).pk);
const OTHER_PK_REAL = '0x' + bytesToHex(wotsKeypairFromSeed(OTHER_SEED, 0).pk);
const ATTACKER_PK = '0x' + bytesToHex(wotsKeypairFromSeed(ATTACKER_SEED, 0).pk);
const DIGEST_BYTES = sha3_256(hexToBytes(TX_HEX));
const sign = (seed: Uint8Array) => '0x' + bytesToHex(wotsSign(seed, 0, DIGEST_BYTES));

function record(config: MultisigConfig, signatures: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    config,
    transactionHex: TX_HEX,
    transactionDigest: '0x' + bytesToHex(DIGEST_BYTES),
    signatures,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    status: 'pending',
    ...overrides,
  };
}

async function loadRecord(rec: unknown): Promise<MultisigManager> {
  const store = new MemoryStore();
  await store.set('totem_pending_multisig', { version: 1, transactions: [rec] });
  const mgr = new MultisigManager(store);
  await mgr.ready;
  return mgr;
}

describe('RFC-020 TXB-MULTISIG-005: load binds signature identity to its publicKey', () => {
  const config: MultisigConfig = { type: '2of2', threshold: 2, publicKeys: [OWN_PK_REAL, OTHER_PK_REAL], ownPublicKey: OWN_PK_REAL };

  it('does not count one attacker signature duplicated under two configured keys', async () => {
    const attackerSig = sign(ATTACKER_SEED);
    const mgr = await loadRecord(
      record(config, {
        [OWN_PK_REAL]: { publicKey: ATTACKER_PK, signature: attackerSig, signatureType: 'wots', validated: true },
        [OTHER_PK_REAL]: { publicKey: ATTACKER_PK, signature: attackerSig, signatureType: 'wots', validated: true },
      }),
    );
    expect(await mgr.isReady('rec-1')).toBe(false);
  });

  it('collapses a duplicated publicKey under two record keys to one signer', async () => {
    const ownSig = sign(OWN_SEED);
    const mgr = await loadRecord(
      record(config, {
        [OWN_PK_REAL]: { publicKey: OWN_PK_REAL, signature: ownSig, signatureType: 'wots', validated: true },
        [OTHER_PK_REAL]: { publicKey: OWN_PK_REAL, signature: ownSig, signatureType: 'wots', validated: true },
      }),
    );
    expect(await mgr.isReady('rec-1')).toBe(false);
  });

  it('accepts two distinct configured signers with valid signatures', async () => {
    const mgr = await loadRecord(
      record(config, {
        [OWN_PK_REAL]: { publicKey: OWN_PK_REAL, signature: sign(OWN_SEED), signatureType: 'wots', validated: true },
        [OTHER_PK_REAL]: { publicKey: OTHER_PK_REAL, signature: sign(OTHER_SEED), signatureType: 'wots', validated: true },
      }),
    );
    expect(await mgr.isReady('rec-1')).toBe(true);
  });
});

describe('RFC-020 TXB-MULTISIG-006: load rebinds the digest to transactionHex', () => {
  it('rejects a record whose transactionHex does not hash to transactionDigest', async () => {
    const config: MultisigConfig = { type: 'mofn', threshold: 1, publicKeys: [OWN_PK_REAL], ownPublicKey: OWN_PK_REAL };
    const tampered = record(
      config,
      { [OWN_PK_REAL]: { publicKey: OWN_PK_REAL, signature: sign(OWN_SEED), signatureType: 'wots', validated: true } },
      { transactionHex: '0x' + '02'.repeat(64) }, // does not match transactionDigest
    );
    const store = new MemoryStore();
    await store.set('totem_pending_multisig', { version: 1, transactions: [tampered] });
    const mgr = new MultisigManager(store);
    await expect(mgr.ready).rejects.toThrow(/digest does not match/);
  });
});
