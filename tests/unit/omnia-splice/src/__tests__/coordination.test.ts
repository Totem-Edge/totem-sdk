/**
 * RFC-035 B1 — splice peer round-trip over the coordination transport.
 *
 * Uses mock WOTS (matching omnia-splice's own tests) with an injected verifier.
 */

import { sha3_256 } from '@totemsdk/core';
import { MAX_HASH } from '@totemsdk/txpow';
import {
  _resetChannelWatermarks,
  createOmniaCoordination,
  DefaultEltooPaymentProgram,
} from '@totemsdk/omnia';
import type { OmniaChannel, ChannelSigner, OmniaPeer, OmniaMessage } from '@totemsdk/omnia';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import { createSpliceCoordination } from '../coordination.js';
import { quiesceChannel, proposeSpliceIn } from '../index.js';
import type { SpliceLeaseProvider, SplicedChannel } from '../index.js';

const PKD_ALICE = '0x' + 'aa'.repeat(32);
const PKD_BOB = '0x' + 'bb'.repeat(32);
const FUNDING_COIN_ID = '0x' + 'cc'.repeat(32);
const FUNDING_ADDRESS = '0x' + 'dd'.repeat(32);
const NEW_COIN_ID = '0x' + '11'.repeat(32);
const TOKEN_ID = '0x00';

function mockVerify(sig: Uint8Array, digest: Uint8Array, pkd: string): boolean {
  const expected = sha3_256(new Uint8Array([...Buffer.from(pkd.slice(2), 'hex'), ...digest]));
  return expected.length === sig.length && expected.every((b, i) => b === sig[i]);
}

function makeSigner(pkd: string): ChannelSigner {
  return {
    publicKeyDigest: pkd,
    async sign(payload: Uint8Array) {
      return sha3_256(new Uint8Array([...Buffer.from(pkd.slice(2), 'hex'), ...payload]));
    },
  };
}

function makeWotsLease(): WotsLeaseProvider {
  let c = 0;
  return {
    reserveKeyUse: jest.fn(async () => ({ reservationId: `r-${++c}`, indices: { l1: c, l2: 0, addressIndex: 0 }, expiresAt: Date.now() + 3_600_000 })),
    commitKeyUse: jest.fn(async () => {}),
    burnReservation: jest.fn(async () => {}),
    getLocalWatermark: async (treeId: string) => ({ treeId, addressCursor: 0, l1Cursor: 0, l2Cursor: 0, unavailableCount: 0, capacity: 4096 }),
    publishWatermark: async () => {},
    syncLeaseJournal: async () => ({ synced: true, conflicts: [] }),
    verifyLeaseCertificate: async () => true,
  } as unknown as WotsLeaseProvider;
}

function makeLeaseProvider(pkd: string): { lp: SpliceLeaseProvider; wotsLease: WotsLeaseProvider } {
  const wotsLease = makeWotsLease();
  return { lp: { signer: makeSigner(pkd), wotsLease }, wotsLease };
}

let _seq = 0;
function makeChannel(): OmniaChannel {
  const s = ++_seq;
  return {
    channelId: '0xab' + s.toString(16).padStart(62, '0'),
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
    onMessage(cb) {
      listeners[id].add(cb);
      return () => listeners[id].delete(cb);
    },
    disconnect() {},
    onReconnecting() {
      return () => {};
    },
    onReconnected() {
      return () => {};
    },
  });
  return {
    A: make('A', 'B'),
    B: make('B', 'A'),
    emit: (to: 'A' | 'B', m: OmniaMessage) => [...listeners[to]].forEach((l) => l(m)),
  };
}

async function waitFor(cond: () => boolean, ms = 5000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 5));
  }
}

const tick = () => new Promise((r) => setTimeout(r, 10));

describe('splice coordination round-trip (RFC-035 B1)', () => {
  beforeEach(() => {
    _resetChannelWatermarks();
  });

  it('finalizes and commits both leases on SPLICE_FINALIZED', async () => {
    const ch = makeChannel();
    const { A, B } = createLink();
    const alice = makeLeaseProvider(PKD_ALICE);
    const bob = makeLeaseProvider(PKD_BOB);

    let finalized: SplicedChannel | undefined;
    const aliceChannels = new Map<string, OmniaChannel | never>([[ch.channelId, ch]]);
    const bobChannels = new Map<string, OmniaChannel | never>([[ch.channelId, ch]]);

    const aliceSplice = createSpliceCoordination({
      channels: aliceChannels as never,
      leaseProvider: alice.lp,
      verifySignature: mockVerify,
      finalizeOptions: { mineDifficulty: MAX_HASH, verifySignature: mockVerify },
      onFinalized: (s) => {
        finalized = s;
      },
    });
    const bobSplice = createSpliceCoordination({
      channels: bobChannels as never,
      leaseProvider: bob.lp,
      verifySignature: mockVerify,
    });

    const aliceCoord = createOmniaCoordination({ policy: { autoAccept: true }, handlers: aliceSplice.handlers });
    const bobCoord = createOmniaCoordination({ policy: { autoAccept: true }, handlers: bobSplice.handlers });
    aliceCoord.bindPeer(A);
    bobCoord.bindPeer(B);

    await aliceSplice.propose(A, aliceCoord, ch, {
      type: 'in',
      additionalCoinId: NEW_COIN_ID,
      additionalAmount: 500n,
    });

    await waitFor(() => finalized !== undefined);

    expect(finalized!.status).toBe('active');
    expect(finalized!.totalValue).toBe(1500n);
    // proposer commit (via finalizeSplice) + acceptor commit (via SPLICE_FINALIZED)
    expect(alice.wotsLease.commitKeyUse).toHaveBeenCalled();
    expect(bob.wotsLease.commitKeyUse).toHaveBeenCalled();
    expect(bob.wotsLease.burnReservation).not.toHaveBeenCalled();
  });

  it('the acceptor does not sign when approval is denied', async () => {
    const ch = makeChannel();
    const { A, B } = createLink();
    const alice = makeLeaseProvider(PKD_ALICE);
    const bob = makeLeaseProvider(PKD_BOB);

    let finalized: SplicedChannel | undefined;
    const aliceSplice = createSpliceCoordination({
      channels: new Map([[ch.channelId, ch]]) as never,
      leaseProvider: alice.lp,
      verifySignature: mockVerify,
      finalizeOptions: { mineDifficulty: MAX_HASH, verifySignature: mockVerify },
      onFinalized: (s) => {
        finalized = s;
      },
    });
    const bobSplice = createSpliceCoordination({
      channels: new Map([[ch.channelId, ch]]) as never,
      leaseProvider: bob.lp,
      verifySignature: mockVerify,
      approval: async () => false,
    });
    const aliceCoord = createOmniaCoordination({ policy: { autoAccept: true }, handlers: aliceSplice.handlers });
    const bobCoord = createOmniaCoordination({ policy: {}, handlers: bobSplice.handlers });
    aliceCoord.bindPeer(A);
    bobCoord.bindPeer(B);

    await aliceSplice.propose(A, aliceCoord, ch, { type: 'in', additionalCoinId: NEW_COIN_ID, additionalAmount: 500n });
    await tick();

    expect(finalized).toBeUndefined();
    expect(bob.wotsLease.commitKeyUse).not.toHaveBeenCalled();
  });

  it('rejects a proposal with a bad proposer signature (verify-before-sign)', async () => {
    const ch = makeChannel();
    const { B, emit } = createLink();
    const alice = makeLeaseProvider(PKD_ALICE);
    const bob = makeLeaseProvider(PKD_BOB);

    const bobSplice = createSpliceCoordination({
      channels: new Map([[ch.channelId, ch]]) as never,
      leaseProvider: bob.lp,
      verifySignature: mockVerify,
    });
    const bobCoord = createOmniaCoordination({ policy: { autoAccept: true }, handlers: bobSplice.handlers });
    bobCoord.bindPeer(B);

    const q = await quiesceChannel(ch, alice.lp);
    const bad = await proposeSpliceIn(q, NEW_COIN_ID, 500n, alice.lp);
    bad.proposerSignature = new Uint8Array([9, 9, 9]);

    emit('B', { type: 'SPLICE_PROPOSAL', channelId: ch.channelId, correlationId: bad.spliceId, nonce: 1, payload: bad });
    await tick();

    expect(bob.wotsLease.reserveKeyUse).not.toHaveBeenCalled();
  });
});
