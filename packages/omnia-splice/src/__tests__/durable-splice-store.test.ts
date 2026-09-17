/**
 * Durable splice-state store tests (RFC-007 G9).
 *
 * Multi-channel partial-op recovery for splice: a splice spans propose → quiesce
 * (already done before propose) → accept → broadcast → finalize. The crash-window
 * gate is: kill the host between `proposeSpliceIn` (proposer signed) and
 * `acceptSplice` (acceptor co-signed) — the persisted proposal must survive a
 * restart, and the partial acceptance must be recoverable/reconcilable, never
 * silently discarded or re-proposed with a fresh key slot.
 *
 * Real `proposeSpliceIn`/`acceptSplice` are exercised so the persisted records
 * carry the real signed bytes and reserve keys.
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { sha3_256 } from '@totemsdk/core';
import { MAX_HASH } from '@totemsdk/txpow';
import type { OmniaChannel, ChannelSigner } from '@totemsdk/omnia';
import { DefaultEltooPaymentProgram } from '@totemsdk/omnia';
import type { SigningIndices, WotsLeaseProvider } from '@totemsdk/wots-lease';

import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';
import type { StorageAdapterWithCapabilities, CasStore } from '@totemsdk/storage/types';

import { createDurableSpliceStore } from '../durable-splice-store.js';
import { quiesceChannel } from '../quiesce.js';
import { proposeSpliceIn } from '../splice.js';
import { acceptSplice } from '../splice.js';
import type { SpliceLeaseProvider, QuiescedChannel, SpliceProposal, SpliceAcceptance } from '../types.js';

const VOLATILE = { requireAckMode: 'volatile' as const };

// ─── Mock helpers (mirror omnia-splice.test.ts) ───────────────────────────────

const PKD_ALICE = '0x' + 'aa'.repeat(32);
const PKD_BOB = '0x' + 'bb'.repeat(32);
const FUNDING_COIN_ID = '0x' + 'cc'.repeat(32);
const FUNDING_ADDRESS = '0x' + 'dd'.repeat(32);
const NEW_COIN_ID = '0x' + '11'.repeat(32);
const TOKEN_ID = '0x00';

function mockVerifySignature(sig: Uint8Array, digest: Uint8Array, pkd: string): boolean {
  const expected = sha3_256(new Uint8Array([...Buffer.from(pkd.slice(2), 'hex'), ...digest]));
  return expected.length === sig.length && expected.every((b, i) => b === sig[i]);
}

function makeSigner(pkd: string): ChannelSigner {
  return {
    publicKeyDigest: pkd,
    async sign(payload: Uint8Array, _indices: SigningIndices) {
      return sha3_256(new Uint8Array([...Buffer.from(pkd.slice(2), 'hex'), ...payload]));
    },
  };
}

function makeMockWotsLease(): WotsLeaseProvider {
  let counter = 0;
  return {
    reserveKeyUse: jest.fn(async () => {
      const idx = ++counter;
      return { reservationId: `test-res-${idx}`, indices: { l1: idx, l2: 0, addressIndex: 0 }, expiresAt: Date.now() + 3_600_000 };
    }),
    commitKeyUse:      jest.fn(async () => {}),
    burnReservation:   jest.fn(async () => {}),
    getLocalWatermark: jest.fn(async (treeId) => ({ treeId, addressCursor: 0, l1Cursor: 0, l2Cursor: 0, unavailableCount: 0, capacity: 4096 })),
    publishWatermark:        jest.fn(async () => {}),
    syncLeaseJournal:        jest.fn(async () => ({ synced: true, conflicts: [] })),
    verifyLeaseCertificate:  jest.fn(async () => true),
  };
}

function makeLeaseProvider(pkd: string): SpliceLeaseProvider {
  return { signer: makeSigner(pkd), wotsLease: makeMockWotsLease() };
}

let _channelIdSeq = 0;
function makeChannel(overrides: Partial<OmniaChannel> = {}): OmniaChannel {
  const seq = ++_channelIdSeq;
  return {
    channelId: '0xab' + seq.toString(16).padStart(62, '0'),
    fundingTxId: '0x' + 'ef'.repeat(32),
    fundingCoinId: FUNDING_COIN_ID,
    fundingScript: 'RETURN TRUE',
    programId: DefaultEltooPaymentProgram.id,
    programVersion: DefaultEltooPaymentProgram.version,
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
    ...overrides,
  } as OmniaChannel;
}

async function quiesce(ch: OmniaChannel): Promise<QuiescedChannel> {
  return quiesceChannel(ch, makeLeaseProvider(PKD_ALICE));
}



describe('createDurableSpliceStore', () => {
  describe('MemoryStore (volatile) — parity', () => {
    it('persists and reads back a splice proposal', async () => {
      const store = createDurableSpliceStore(new MemoryStore(), VOLATILE);
      const proposal = await proposeSpliceIn(await quiesce(makeChannel()), NEW_COIN_ID, 500n, makeLeaseProvider(PKD_ALICE));
      await store.saveProposal(proposal);
      const record = await store.getSplice(proposal.spliceId);
      expect(record).toBeDefined();
      expect(record?.status).toBe('pending');
      expect(record?.proposal.spliceTxHex).toBe(proposal.spliceTxHex);
      expect(store.hasState()).resolves.toBe(true);
    });

    it('records real acceptance signatures and lists pending/accepted splices', async () => {
      const store = createDurableSpliceStore(new MemoryStore(), VOLATILE);
      const channel = await quiesce(makeChannel());
      const proposal = await proposeSpliceIn(channel, NEW_COIN_ID, 200n, makeLeaseProvider(PKD_ALICE), { alice: 700n, bob: 500n });
      const acceptance = await acceptSplice(channel, proposal, makeLeaseProvider(PKD_BOB));
      await store.saveProposal(proposal);
      await store.saveAcceptance(acceptance);

      expect((await store.getSplice(proposal.spliceId))?.status).toBe('accepted');
      expect(await store.listPending()).toHaveLength(0);
      expect(await store.listSplices(proposal.channelId)).toHaveLength(1);
      // The persisted proposal must carry the real signed bytes (recoverable).
      expect(recordProposalOf(store, proposal.spliceId)).resolves.toBe(proposal.spliceTxHex);
    });

    it('rejects an acceptance for an unknown splice', async () => {
      const store = createDurableSpliceStore(new MemoryStore(), VOLATILE);
      const channel = await quiesce(makeChannel());
      const proposal = await proposeSpliceIn(channel, NEW_COIN_ID, 200n, makeLeaseProvider(PKD_ALICE), { alice: 700n, bob: 500n });
      const acceptance = await acceptSplice(channel, proposal, makeLeaseProvider(PKD_BOB));
      const acceptanceForUnknown: SpliceAcceptance = { ...acceptance, spliceId: 'no-such-splice' };
      await expect(store.saveAcceptance(acceptanceForUnknown)).rejects.toMatchObject({ code: 'write-failed' });
    });

    it('marks a splice finalized', async () => {
      const store = createDurableSpliceStore(new MemoryStore(), VOLATILE);
      const channel = await quiesce(makeChannel());
      const proposal = await proposeSpliceIn(channel, NEW_COIN_ID, 200n, makeLeaseProvider(PKD_ALICE), { alice: 700n, bob: 500n });
      const acceptance = await acceptSplice(channel, proposal, makeLeaseProvider(PKD_BOB));
      await store.saveProposal(proposal);
      await store.saveAcceptance(acceptance);
      await store.markFinalized(proposal.spliceId);
      expect((await store.getSplice(proposal.spliceId))?.status).toBe('finalized');
    });
  });

  describe('FileStore (durable) — crash-window and corruption', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'totem-omnia-splice-'));
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('recovers a partial splice commit across a mid-acceptance restart', async () => {
      const adapter: StorageAdapterWithCapabilities & CasStore = new FileStore(dir);

      // ── Phase 1: proposer signs; host persists the proposal. ──
      const channel = await quiesce(makeChannel());
      const proposal: SpliceProposal = await proposeSpliceIn(
        channel, NEW_COIN_ID, 500n, makeLeaseProvider(PKD_ALICE), { alice: 900n, bob: 600n },
      );

      let store = createDurableSpliceStore(adapter);
      await store.saveProposal(proposal);
      // ── "Crash" here: acceptor never co-signed. ──

      // ── Restart: brand-new store over the SAME adapter. ──
      store = createDurableSpliceStore(adapter);
      expect(await store.hasState()).toBe(true);
      const pending = await store.listPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].spliceId).toBe(proposal.spliceId);
      expect(pending[0].status).toBe('pending');
      // The signed proposal is recoverable byte-for-byte.
      expect(pending[0].proposal.spliceTxHex).toBe(proposal.spliceTxHex);

      // ── Phase 2: acceptor co-signs on the recovered proposal and it finalizes. ──
      const acceptance: SpliceAcceptance = await acceptSplice(channel, pending[0].proposal, makeLeaseProvider(PKD_BOB));
      await store.saveAcceptance(acceptance);
      expect((await store.getSplice(proposal.spliceId))?.status).toBe('accepted');

      // ── Phase 3: broadcast + finalize; the store marks it finalized. ──
      await store.markFinalized(proposal.spliceId);
      const done = await store.getSplice(proposal.spliceId);
      expect(done?.status).toBe('finalized');
      expect(done?.acceptance?.acceptorPublicKeyDigest).toBe(PKD_BOB);
    });

    it('does not fail-open on a corrupt splice record (strict)', async () => {
      const adapter: StorageAdapterWithCapabilities & CasStore = new FileStore(dir);
      const store = createDurableSpliceStore(adapter);
      const proposal = await proposeSpliceIn(await quiesce(makeChannel()), NEW_COIN_ID, 500n, makeLeaseProvider(PKD_ALICE));
      await store.saveProposal(proposal);

      await adapter.set('totem_omnia_splice:v1:snapshot', { shreds: true });
      await expect(store.listSplices()).rejects.toMatchObject({ code: 'corrupt' });
      expect(await store.hasState()).toBe(true);
    });

    it('rejects an unsupported snapshot version instead of reinitialising', async () => {
      const adapter: StorageAdapterWithCapabilities & CasStore = new FileStore(dir);
      const proposal = await proposeSpliceIn(await quiesce(makeChannel()), NEW_COIN_ID, 500n, makeLeaseProvider(PKD_ALICE));
      const store = createDurableSpliceStore(adapter);
      await store.saveProposal(proposal);

      await adapter.set('totem_omnia_splice:v1:snapshot', {
        version: 99, revision: 1, savedAt: Date.now(), state: { splices: {} },
      });
      await expect(store.listSplices()).rejects.toMatchObject({ code: 'corrupt' });
      expect(await store.hasState()).toBe(true);
    });

    it('rejects a volatile adapter under the durable default (no silent downgrade)', () => {
      expect(() => createDurableSpliceStore(new MemoryStore())).toThrow(
        /acknowledges "volatile" but consumer requires "durably-acknowledged"/,
      );
    });
  });
});

async function recordProposalOf(store: ReturnType<typeof createDurableSpliceStore>, spliceId: string): Promise<string | undefined> {
  const record = await store.getSplice(spliceId);
  return record?.proposal.spliceTxHex;
}