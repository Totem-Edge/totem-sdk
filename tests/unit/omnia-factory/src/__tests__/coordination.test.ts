/**
 * RFC-035 B2 — factory opening round-trip over the coordination transport.
 * Mock WOTS bundles (verify: () => true), matching omnia-factory's own tests.
 */

import { createOmniaCoordination } from '@totemsdk/omnia';
import type { OmniaPeer, OmniaMessage } from '@totemsdk/omnia';
import { createFactory, acceptFactory } from '../factory.js';
import { buildFactorySettlement } from '../settlement.js';
import { createFactoryCoordination } from '../coordination.js';
import type { ChannelFactory, FactoryParticipant, FactorySettlementPayload, WotsLeaseBundle } from '../index.js';

const TOKEN_A = '0x00';
const PKD_ALICE = '0x' + 'aa'.repeat(32);
const PKD_BOB = '0x' + 'bb'.repeat(32);

const ALICE: FactoryParticipant = { partyId: 'alice', publicKeyDigest: PKD_ALICE, addressIndex: 0, contributionAmount: 1000n };
const BOB: FactoryParticipant = { partyId: 'bob', publicKeyDigest: PKD_BOB, addressIndex: 1, contributionAmount: 1000n };

function makeMockLeaseProvider() {
  let counter = 0;
  return {
    reserveKeyUse: jest.fn(async () => ({ reservationId: `res-${counter++}`, indices: { addressIndex: 0, l1: 0, l2: counter - 1 }, expiresAt: Date.now() + 60_000 })),
    commitKeyUse: jest.fn(async () => {}),
    burnReservation: jest.fn(async () => {}),
  };
}

function makeBundle(pkd: string): { bundle: WotsLeaseBundle; lease: ReturnType<typeof makeMockLeaseProvider> } {
  const lease = makeMockLeaseProvider();
  return {
    lease,
    bundle: {
      leaseProvider: lease as never,
      signer: { publicKeyDigest: pkd, sign: jest.fn(async () => new Uint8Array(64).fill(pkd.charCodeAt(2))) } as never,
      verify: () => true,
    },
  };
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
  return { A: make('A', 'B'), B: make('B', 'A'), emit: (to: 'A' | 'B', m: OmniaMessage) => [...listeners[to]].forEach((l) => l(m)) };
}

async function waitFor(cond: () => boolean, ms = 15000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe('factory opening coordination (RFC-035 B2)', () => {
  it('opens N-of-N: collects the co-signer signature and commits its held lease', async () => {
    const alice = makeBundle(PKD_ALICE);
    const bob = makeBundle(PKD_BOB);
    const { A, B } = createLink();

    const opening = await createFactory([ALICE, BOB], TOKEN_A, alice.bundle);
    expect(opening.status).toBe('opening');

    let opened: ChannelFactory | undefined;
    const aliceFn = createFactoryCoordination({
      factories: new Map([[opening.factoryId, opening]]),
      bundle: alice.bundle,
      verifySignature: () => true,
      onOpened: (f) => {
        opened = f;
      },
    });
    const bobFn = createFactoryCoordination({
      factories: new Map(),
      bundle: bob.bundle,
      verifySignature: () => true,
    });
    const aliceCoord = createOmniaCoordination({ policy: { autoAccept: true }, handlers: aliceFn.handlers });
    const bobCoord = createOmniaCoordination({ policy: { autoAccept: true }, handlers: bobFn.handlers });
    aliceCoord.bindPeer(A);
    bobCoord.bindPeer(B);

    await aliceFn.openFactory(A, aliceCoord, opening);

    await waitFor(() => opened !== undefined);
    // The co-signer commits its lease asynchronously, possibly after Alice's
    // `onOpened` fires — wait for it explicitly to avoid a flaky race.
    await waitFor(() => bob.lease.commitKeyUse.mock.calls.length > 0);
    expect(opened!.status).toBe('active');
    expect(opened!.currentSequence).toBe(1);
    expect(bob.lease.commitKeyUse).toHaveBeenCalled();
    expect(bob.lease.burnReservation).not.toHaveBeenCalled();
  });

  it('the co-signer does not sign when approval is denied', async () => {
    const alice = makeBundle(PKD_ALICE);
    const bob = makeBundle(PKD_BOB);
    const { A, B } = createLink();
    const opening = await createFactory([ALICE, BOB], TOKEN_A, alice.bundle);

    let opened: ChannelFactory | undefined;
    const aliceFn = createFactoryCoordination({
      factories: new Map([[opening.factoryId, opening]]),
      bundle: alice.bundle,
      verifySignature: () => true,
      onOpened: (f) => {
        opened = f;
      },
    });
    const bobFn = createFactoryCoordination({
      factories: new Map(),
      bundle: bob.bundle,
      verifySignature: () => true,
      approval: async () => false,
    });
    const aliceCoord = createOmniaCoordination({ policy: { autoAccept: true }, handlers: aliceFn.handlers });
    const bobCoord = createOmniaCoordination({ policy: {}, handlers: bobFn.handlers });
    aliceCoord.bindPeer(A);
    bobCoord.bindPeer(B);

    await aliceFn.openFactory(A, aliceCoord, opening);
    await new Promise((r) => setTimeout(r, 300));

    expect(opened).toBeUndefined();
    expect(bob.lease.commitKeyUse).not.toHaveBeenCalled();
    expect(bob.lease.reserveKeyUse).not.toHaveBeenCalled();
  });
});

describe('factory close coordination (RFC-035 B3)', () => {
  async function makeActive(alice: ReturnType<typeof makeBundle>, bob: ReturnType<typeof makeBundle>): Promise<ChannelFactory> {
    let f = await createFactory([ALICE, BOB], TOKEN_A, alice.bundle);
    f = await acceptFactory(f, bob.bundle);
    return { ...f, fundingCoinId: '0x' + 'ab'.repeat(32) };
  }

  it('closes N-of-N: gathers settlement signatures and commits held leases', async () => {
    const alice = makeBundle(PKD_ALICE);
    const bob = makeBundle(PKD_BOB);
    const { A, B } = createLink();
    const factory = await makeActive(alice, bob);
    expect(factory.status).toBe('active');

    let closed: FactorySettlementPayload | undefined;
    const aliceFn = createFactoryCoordination({
      factories: new Map([[factory.factoryId, factory]]),
      bundle: alice.bundle,
      verifySignature: () => true,
      onClosed: (p) => {
        closed = p;
      },
    });
    const bobFn = createFactoryCoordination({
      factories: new Map([[factory.factoryId, factory]]),
      bundle: bob.bundle,
      verifySignature: () => true,
    });
    const aliceCoord = createOmniaCoordination({ policy: { autoAccept: true }, handlers: aliceFn.handlers });
    const bobCoord = createOmniaCoordination({ policy: { autoAccept: true }, handlers: bobFn.handlers });
    aliceCoord.bindPeer(A);
    bobCoord.bindPeer(B);

    await aliceFn.closeFactory(A, aliceCoord, factory);
    await waitFor(() => closed !== undefined);

    expect(closed!.factoryId).toBe(factory.factoryId);
    expect(closed!.settlementTxHex).toBeTruthy();
    expect(alice.lease.commitKeyUse).toHaveBeenCalled();
    expect(bob.lease.commitKeyUse).toHaveBeenCalled();
    expect(bob.lease.burnReservation).not.toHaveBeenCalled();
  });

  it('rejects a close proposal whose settlement draft does not match local state (B3)', async () => {
    const alice = makeBundle(PKD_ALICE);
    const bob = makeBundle(PKD_BOB);
    const { B, emit } = createLink();
    const factory = await makeActive(alice, bob);

    const bobFn = createFactoryCoordination({
      factories: new Map([[factory.factoryId, factory]]),
      bundle: bob.bundle,
      verifySignature: () => true,
    });
    const bobCoord = createOmniaCoordination({ policy: { autoAccept: true }, handlers: bobFn.handlers });
    bobCoord.bindPeer(B);

    // A draft built from a DIFFERENT factory (tampered allocations) is rejected.
    const tampered = { ...factory, allocations: { alice: 900n, bob: 1100n } };
    const draft = buildFactorySettlement(tampered);

    const reservesBefore = (bob.lease.reserveKeyUse as jest.Mock).mock.calls.length;
    emit('B', {
      type: 'FACTORY_CLOSE_PROPOSAL',
      channelId: factory.factoryId,
      correlationId: factory.factoryId,
      nonce: 1,
      payload: { factoryId: factory.factoryId, draft },
    });
    await new Promise((r) => setTimeout(r, 20));

    // no settlement reservation was made for the tampered draft
    expect((bob.lease.reserveKeyUse as jest.Mock).mock.calls.length).toBe(reservesBefore);
  });
});

describe('virtual channel open coordination (RFC-035 B3)', () => {
  async function makeActive(alice: ReturnType<typeof makeBundle>, bob: ReturnType<typeof makeBundle>): Promise<ChannelFactory> {
    let f = await createFactory([ALICE, BOB], TOKEN_A, alice.bundle);
    f = await acceptFactory(f, bob.bundle);
    return { ...f, fundingCoinId: '0x' + 'ab'.repeat(32) };
  }

  it('opens N-of-N: gathers VC-open signatures and commits held leases', async () => {
    const alice = makeBundle(PKD_ALICE);
    const bob = makeBundle(PKD_BOB);
    const { A, B } = createLink();
    const factory = await makeActive(alice, bob);

    let openedVc: { channelId: string; status: string; totalValue: bigint } | undefined;
    const aliceFn = createFactoryCoordination({
      factories: new Map([[factory.factoryId, factory]]),
      bundle: alice.bundle,
      verifySignature: () => true,
      onVcOpened: (_f, channel) => {
        openedVc = channel;
      },
    });
    const bobFn = createFactoryCoordination({
      factories: new Map([[factory.factoryId, factory]]),
      bundle: bob.bundle,
      verifySignature: () => true,
    });
    const aliceCoord = createOmniaCoordination({ policy: { autoAccept: true }, handlers: aliceFn.handlers });
    const bobCoord = createOmniaCoordination({ policy: { autoAccept: true }, handlers: bobFn.handlers });
    aliceCoord.bindPeer(A);
    bobCoord.bindPeer(B);

    await aliceFn.openVirtualChannel(A, aliceCoord, factory, ['alice', 'bob'], { alice: 100n, bob: 200n });
    await waitFor(() => openedVc !== undefined);

    expect(openedVc!.status).toBe('active');
    expect(openedVc!.totalValue).toBe(300n);
    expect(bob.lease.commitKeyUse).toHaveBeenCalled();
    expect(bob.lease.burnReservation).not.toHaveBeenCalled();
  });
});

