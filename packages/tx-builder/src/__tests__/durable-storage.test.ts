/**
 * tx-builder durable-storage tests (RFC-007 G10).
 *
 * `KeyValueStorage` is dissolved onto core `StorageAdapter` (§4.1); multisig
 * config + pending transactions are durable with an explicit on-disk record
 * version (format detection, legacy migration, refusal to open unsupported/ambiguous
 * state — §4.2), while coin-selection excluded-address scratch stays ephemeral
 * and rebuildable.
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { sha3_256, hexToBytes, bytesToHex } from '@totemsdk/core';
import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';
import {
  MultisigManager,
  MultisigStorageError,
  type MultisigConfig,
  type PendingMultisigTransaction,
} from '../multisig-manager.js';
import { CoinSelectionService } from '../coin-selection.js';
import type { StoragePort } from '../adapters.js';

const OWN_PK = '0x' + 'aa'.repeat(32);
const OTHER_PK = '0x' + 'cc'.repeat(32);
const MOCK_SIG = '0x' + 'de'.repeat(1088);
const MOCK_TX_HEX = '0x' + '01'.repeat(64);
const MOCK_DIGEST = '0x' + bytesToHex(sha3_256(hexToBytes(MOCK_TX_HEX)));

function makeConfig(overrides: Partial<MultisigConfig> = {}): MultisigConfig {
  return {
    type: '2of2',
    threshold: 2,
    publicKeys: [OWN_PK, OTHER_PK],
    ownPublicKey: OWN_PK,
    ...overrides,
  };
}

async function makeTx(storage: StoragePort): Promise<{ manager: MultisigManager; tx: PendingMultisigTransaction }> {
  const manager = new MultisigManager(storage);
  const tx = await manager.createPendingTransaction(makeConfig(), MOCK_TX_HEX, MOCK_DIGEST);
  await manager.addOwnSignature(tx.id, MOCK_SIG);
  return { manager, tx };
}

describe('MultisigManager durable storage (G10)', () => {
  describe('versioned record reopen + migration (FileStore)', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'totem-txbuilder-'));
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('writes a versioned record and reopens it across a fresh manager', async () => {
      await makeTx(new FileStore(dir) as StoragePort);

      const reopened = new MultisigManager(new FileStore(dir) as StoragePort);
      const txs = await reopened.getAllPending();
      expect(txs).toHaveLength(1);
      expect(txs[0].transactionDigest).toBe(MOCK_DIGEST);
      expect(txs[0].status).toBe('pending');
      const sigs = await reopened.getSignatures(txs[0].id);
      expect(sigs).toHaveLength(1);
      expect(sigs[0].publicKey).toBe(OWN_PK);
    });

    it('migrates the legacy pre-G10 record (no version) to the versioned envelope', async () => {
      const store = new FileStore(dir);
      const legacy = {
        transactions: [
          {
            id: 'legacy-tx-1',
            config: makeConfig(),
            transactionHex: MOCK_TX_HEX,
            transactionDigest: MOCK_DIGEST,
            signatures: { [OWN_PK.toLowerCase()]: { publicKey: OWN_PK, signature: MOCK_SIG, signatureType: 'wots', validated: true } },
            createdAt: Date.now(),
            expiresAt: Date.now() + 86_400_000,
            status: 'pending',
          },
        ],
      };
      await store.set('totem_pending_multisig', legacy);

      const manager = new MultisigManager(store as StoragePort);
      const txs = await manager.getAllPending();
      expect(txs).toHaveLength(1);
      expect(txs[0].id).toBe('legacy-tx-1');

      const raw = await store.get('totem_pending_multisig');
      expect((raw as { version: number }).version).toBe(1);
    });

    it('refuses to open an unsupported future version (never silently reinitialised)', async () => {
      const store = new FileStore(dir);
      await store.set('totem_pending_multisig', { version: 99, transactions: [] });

      await expect(new MultisigManager(store as StoragePort).ready).rejects.toBeInstanceOf(
        MultisigStorageError,
      );
      const raw = await store.get('totem_pending_multisig');
      expect((raw as { version: number }).version).toBe(99); // untouched
    });

    it('refuses to open an ambiguous (non-envelope) record', async () => {
      const store = new FileStore(dir);
      await store.set('totem_pending_multisig', { shreds: true });

      await expect(new MultisigManager(store as StoragePort).ready).rejects.toMatchObject({
        code: 'corrupt',
      });
      expect(await store.has('totem_pending_multisig')).toBe(true); // not wiped
    });
  });

  it('continues to work with volatile in-memory storage', async () => {
    const { manager, tx } = await makeTx(new MemoryStore() as StoragePort);
    expect(tx.status).toBe('pending');
    expect((await manager.getAllPending())[0].id).toBe(tx.id);
  });
});

describe('CoinSelectionService ephemeral scratch classification (G10)', () => {
  it('is rebuildable — excluded addresses are scratch, not durable state', async () => {
    const fetcher = { fetchCoins: jest.fn().mockResolvedValue([]) };
    const service = new CoinSelectionService(fetcher, new MemoryStore() as StoragePort);
    service.addExcludedAddress('MxSCRATCH');

    expect(service.getExcludedAddresses()).toContain('MxSCRATCH');
    // The same service can be rebuilt without any pre-seeded storage:
    const rebuilt = new CoinSelectionService(fetcher);
    expect(rebuilt.getExcludedAddresses()).toHaveLength(0);
    const result = rebuilt.selectCoins([], { mode: 'global', targetAmount: '1' });
    expect(result.insufficientFunds).toBe(true);
  });

  it('persists excluded addresses through a StoragePort when provided', async () => {
    const fetcher = { fetchCoins: jest.fn().mockResolvedValue([]) };
    const store = new MemoryStore() as StoragePort;
    const service = new CoinSelectionService(fetcher, store);
    service.addExcludedAddress('MxKEEP');

    const reloaded = new CoinSelectionService(fetcher, store);
    await reloaded.loadExcludedAddresses();
    expect(reloaded.getExcludedAddresses()).toContain('MxKEEP');
  });
});