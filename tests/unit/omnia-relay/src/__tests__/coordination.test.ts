/**
 * RFC-035 B5 — wallet coordination composition (createWalletCoordination).
 * Two-peer splice round-trip driven through the composed helper.
 */

import { sha3_256 } from '@totemsdk/core';
import { MAX_HASH } from '@totemsdk/txpow';
import { _resetChannelWatermarks, createMemoryCoordinationStore, DefaultEltooPaymentProgram } from '@totemsdk/omnia';
import type { ChannelSigner, OmniaChannel, OmniaPeer, OmniaMessage } from '@totemsdk/omnia';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import { createWalletCoordination } from '../coordination.js';
import type { SpliceLeaseProvider, SplicedChannel } from '@totemsdk/omnia-splice';

const PKD_ALICE = '0x' + 'aa'.repeat(32);
const PKD_BOB = '0x' + 'bb'.repeat(32);
const NEW_COIN_ID = '0x' + '11'.repeat(32);

function mockVerify(sig: Uint8Array, digest: Uint8Array, pkd: string): boolean {
  const expected = sha3_256(new Uint8Array([...Buffer.from(pkd.slice(2), 'hex'), ...digest]));
  return expected.length === sig.length && expected.every((b, i) => b === sig[i]);
}

function makeSigner(pkd: string): ChannelSigner {
  return { publicKeyDigest: pkd, async sign(payload) { return sha3_256(new Uint8Array([...Buffer.from(pkd.slice(2), 'hex'), ...payload])); } };
}

function makeLease(): WotsLeaseProvider {
  let c = 0;
  return {
    reserveKeyUse: jest.fn(async () => ({ reservationId: `r-${++c}`, indices: { addressIndex: 0, l1: c, l2: 0 }, expiresAt: Date.now() + 3_600_000 })),
    commitKeyUse: jest.fn(async () => {}),
    burnReservation: jest.fn(async () => {}),
    getLocalWatermark: async (treeId: string) => ({ treeId, addressCursor: 0, l1Cursor: 0, l2Cursor: 0, unavailableCount: 0, capacity: 4096 }),
    publishWatermark: async () => {},
    syncLeaseJournal: async () => ({ synced: true, conflicts: [] }),
    verifyLeaseCertificate: async () => true,
  } as unknown as WotsLeaseProvider;
}

let seq = 0;
function makeChannel(): OmniaChannel {
  const s = ++seq;
  return {
    channelId: '0xab' + s.toString(16).padStart(62, '0'),
    fundingTxId: '0x' + 'ef'.repeat(32),
    fundingCoinId: '0x' + 'cc'.repeat(32),
    fundingScript: 'RETURN TRUE',
    programId: DefaultEltooPaymentProgram.id,
    programVersion: DefaultEltooPaymentProgram.version,
    fundingAddress: '0x' + 'dd'.repeat(32),
    tokenId: '0x00',
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
    createdAt: 1,
    updatedAt: 1,
  } as OmniaChannel;
}

function createLink() {
  const listeners: Record<'A' | 'B', Set<(m: OmniaMessage) => void>> = { A: new Set(), B: new Set() };
  const make = (id: 'A' | 'B', other: 'A' | 'B'): OmniaPeer => ({
    pubkey: id,
    channelId: undefined,
    async sendMessage(m: OmniaMessage) {
      await new Promise((r) => setTimeout(r, 0));
      [...listeners[other]].forEach((l) => l(m));
    },
    onMessage(cb) { listeners[id].add(cb); return () => listeners[id].delete(cb); },
    disconnect() {},
    onReconnecting() { return () => {}; },
    onReconnected() { return () => {}; },
  });
  return { A: make('A', 'B'), B: make('B', 'A') };
}

async function waitFor(cond: () => boolean, ms = 15000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe('createWalletCoordination (RFC-035 B5)', () => {
  beforeEach(() => _resetChannelWatermarks());

  it('drives a two-peer splice round-trip end-to-end', async () => {
    const ch = makeChannel();
    const { A, B } = createLink();
    const aliceLease = makeLease();
    const bobLease = makeLease();

    let finalized: SplicedChannel | undefined;
    const alice = createWalletCoordination({
      channels: new Map([[ch.channelId, ch]]) as never,
      factories: new Map(),
      signer: makeSigner(PKD_ALICE),
      leaseProvider: aliceLease,
      store: createMemoryCoordinationStore(),
      policy: { autoAccept: true },
      verifySignature: mockVerify,
      spliceFinalizeOptions: { mineDifficulty: MAX_HASH, verifySignature: mockVerify },
      onSpliceFinalized: (s) => { finalized = s; },
    });
    const bob = createWalletCoordination({
      channels: new Map([[ch.channelId, ch]]) as never,
      factories: new Map(),
      signer: makeSigner(PKD_BOB),
      leaseProvider: bobLease,
      store: createMemoryCoordinationStore(),
      policy: { autoAccept: true },
      verifySignature: mockVerify,
    });
    alice.bindPeer(A);
    bob.bindPeer(B);

    await alice.splice.propose(A, alice.coordination, ch, {
      type: 'in',
      additionalCoinId: NEW_COIN_ID,
      additionalAmount: 500n,
    });

    await waitFor(() => finalized !== undefined);
    expect(finalized!.status).toBe('active');
    expect(bobLease.commitKeyUse).toHaveBeenCalled();
  });

  it('does not sign when approval is denied', async () => {
    const ch = makeChannel();
    const { A, B } = createLink();
    const aliceLease = makeLease();
    const bobLease = makeLease();

    let finalized: SplicedChannel | undefined;
    const alice = createWalletCoordination({
      channels: new Map([[ch.channelId, ch]]) as never,
      factories: new Map(),
      signer: makeSigner(PKD_ALICE),
      leaseProvider: aliceLease,
      store: createMemoryCoordinationStore(),
      policy: { autoAccept: true },
      verifySignature: mockVerify,
      spliceFinalizeOptions: { mineDifficulty: MAX_HASH, verifySignature: mockVerify },
      onSpliceFinalized: (s) => { finalized = s; },
    });
    const bob = createWalletCoordination({
      channels: new Map([[ch.channelId, ch]]) as never,
      factories: new Map(),
      signer: makeSigner(PKD_BOB),
      leaseProvider: bobLease,
      store: createMemoryCoordinationStore(),
      policy: {},
      verifySignature: mockVerify,
      approval: async () => false,
    });
    alice.bindPeer(A);
    bob.bindPeer(B);

    await alice.splice.propose(A, alice.coordination, ch, {
      type: 'in',
      additionalCoinId: NEW_COIN_ID,
      additionalAmount: 500n,
    });
    await new Promise((r) => setTimeout(r, 300));

    expect(finalized).toBeUndefined();
    expect(bobLease.commitKeyUse).not.toHaveBeenCalled();
  });
});
