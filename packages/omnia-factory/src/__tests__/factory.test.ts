import {
  createFactory,
  acceptFactory,
  reallocate,
  enforceConservation,
  openVirtualChannel,
  closeVirtualChannel,
  closeFactory,
  buildDisputePayload,
  buildFactoryScript,
  buildAndHashFactoryScript,
  computeFactoryStateCommitment,
} from '../index';
import type {
  ChannelFactory,
  FactoryParticipant,
  WotsLeaseBundle,
  OmniaChannel,
} from '../index';

// ─── Mock builders ────────────────────────────────────────────────────────────

function makeMockLeaseProvider() {
  let counter = 0;
  return {
    reserveKeyUse: jest.fn(async () => ({
      reservationId: `res-${counter++}`,
      indices: { addressIndex: 0, l1: 0, l2: counter - 1 },
      expiresAt: Date.now() + 60_000,
    })),
    commitKeyUse:     jest.fn(async () => {}),
    burnReservation:  jest.fn(async () => {}),
  };
}

function makeMockSigner(pkd: string) {
  return {
    publicKeyDigest: pkd,
    sign: jest.fn(async () => new Uint8Array(64).fill(0x42)),
  };
}

/**
 * A WotsLeaseBundle with a mock leaseProvider, mock signer, and a
 * `verify: () => true` override so tests don't need real WOTS key material.
 */
function makeMockBundle(pkd: string): WotsLeaseBundle {
  return {
    leaseProvider: makeMockLeaseProvider(),
    signer:        makeMockSigner(pkd),
    verify:        () => true,
  };
}

/** Make a pre-populated fail-verify bundle (for error-path tests). */
function makeBadBundle(pkd: string): WotsLeaseBundle {
  return {
    leaseProvider: makeMockLeaseProvider(),
    signer:        makeMockSigner(pkd),
    verify:        () => false,
  };
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TOKEN_A = '0x00';

const ALICE: FactoryParticipant = {
  partyId:            'alice',
  publicKeyDigest:    '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  addressIndex:       0,
  contributionAmount: 1000n,
  settlementAddress:  '0xALICE_SETTLE',
};
const BOB: FactoryParticipant = {
  partyId:            'bob',
  publicKeyDigest:    '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  addressIndex:       1,
  contributionAmount: 500n,
  settlementAddress:  '0xBOB_SETTLE',
};
const CAROL: FactoryParticipant = {
  partyId:            'carol',
  publicKeyDigest:    '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  addressIndex:       2,
  contributionAmount: 500n,
  settlementAddress:  '0xCAROL_SETTLE',
};

// One bundle per participant.
const ALICE_BUNDLE = makeMockBundle(ALICE.publicKeyDigest);
const BOB_BUNDLE   = makeMockBundle(BOB.publicKeyDigest);
const CAROL_BUNDLE = makeMockBundle(CAROL.publicKeyDigest);

const BUNDLES3: Record<string, WotsLeaseBundle> = {
  alice: ALICE_BUNDLE,
  bob:   BOB_BUNDLE,
  carol: CAROL_BUNDLE,
};
const BUNDLES2: Record<string, WotsLeaseBundle> = {
  alice: ALICE_BUNDLE,
  bob:   BOB_BUNDLE,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create and fully activate a factory.
 * Proposer = first participant; all others call `acceptFactory`.
 */
async function makeActiveFactory(participants: FactoryParticipant[]): Promise<ChannelFactory> {
  const bundles: Record<string, WotsLeaseBundle> = {};
  for (const p of participants) {
    bundles[p.partyId] = makeMockBundle(p.publicKeyDigest);
  }
  const proposer = participants[0];
  let f = await createFactory(participants, TOKEN_A, bundles[proposer.partyId]);
  for (const p of participants.slice(1)) {
    f = await acceptFactory(f, bundles[p.partyId]);
  }
  return f;
}

/** Assert balance conservation at every step. */
function checkConservation(factory: ChannelFactory): void {
  const allocSum = Object.values(factory.allocations).reduce((a, b) => a + b, 0n);
  const vcSum    = factory.virtualChannels.reduce((acc, vc) => acc + vc.totalValue, 0n);
  expect(allocSum + vcSum).toBe(factory.totalValue);
}

/** Attach a dummy fundingCoinId to a factory (needed by closeFactory). */
function withFundingCoinId(factory: ChannelFactory, coinId = 'test-coin-001'): ChannelFactory {
  return { ...factory, fundingCoinId: coinId };
}

// ─── 1. Factory script ────────────────────────────────────────────────────────

describe('buildFactoryScript', () => {
  test('generates N-of-N MULTISIG script for 2 parties', () => {
    const script = buildFactoryScript([ALICE, BOB]);
    expect(script).toContain('MULTISIG(2');
    expect(script).toContain('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    expect(script).toContain('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
    expect(script).toContain('LET SETTLEMENT=STATE(100)');
  });

  test('generates N-of-N MULTISIG script for 3 parties', () => {
    const script = buildFactoryScript([ALICE, BOB, CAROL]);
    expect(script).toContain('MULTISIG(3');
    expect(script).toContain('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC');
  });

  test('throws with fewer than 2 participants', () => {
    expect(() => buildFactoryScript([ALICE])).toThrow(/2 participants/);
  });

  test('buildAndHashFactoryScript returns non-empty script and address', () => {
    const { script, address } = buildAndHashFactoryScript([ALICE, BOB]);
    expect(script.length).toBeGreaterThan(0);
    expect(address.length).toBeGreaterThan(0);
  });
});

// ─── 2. State commitment ──────────────────────────────────────────────────────

describe('computeFactoryStateCommitment', () => {
  test('returns 32 bytes', () => {
    expect(computeFactoryStateCommitment('fid', 1, { alice: 1000n }, []).length).toBe(32);
  });

  test('is deterministic regardless of key order', () => {
    const c1 = computeFactoryStateCommitment('fid', 1, { alice: 1000n, bob: 500n }, ['vc-1']);
    const c2 = computeFactoryStateCommitment('fid', 1, { bob: 500n, alice: 1000n }, ['vc-1']);
    expect(Buffer.from(c1).toString('hex')).toBe(Buffer.from(c2).toString('hex'));
  });

  test('differs for different allocations', () => {
    const c1 = computeFactoryStateCommitment('fid', 1, { alice: 1000n }, []);
    const c2 = computeFactoryStateCommitment('fid', 1, { alice: 999n }, []);
    expect(Buffer.from(c1).toString('hex')).not.toBe(Buffer.from(c2).toString('hex'));
  });

  test('differs for different sequences', () => {
    const c1 = computeFactoryStateCommitment('fid', 1, { alice: 1000n }, []);
    const c2 = computeFactoryStateCommitment('fid', 2, { alice: 1000n }, []);
    expect(Buffer.from(c1).toString('hex')).not.toBe(Buffer.from(c2).toString('hex'));
  });
});

// ─── 3. createFactory ─────────────────────────────────────────────────────────

describe('createFactory', () => {
  test('initialises allocations from contributionAmounts', async () => {
    const f = await createFactory([ALICE, BOB, CAROL], TOKEN_A, ALICE_BUNDLE);
    expect(f.allocations).toEqual({ alice: 1000n, bob: 500n, carol: 500n });
    expect(f.totalValue).toBe(2000n);
  });

  test('status is opening', async () => {
    const f = await createFactory([ALICE, BOB], TOKEN_A, ALICE_BUNDLE);
    expect(f.status).toBe('opening');
  });

  test('proposer signature stored in pendingSignatures', async () => {
    const f = await createFactory([ALICE, BOB], TOKEN_A, ALICE_BUNDLE);
    expect(f.pendingSignatures['alice']).toBeInstanceOf(Uint8Array);
    expect(f.pendingSignatures['bob']).toBeUndefined();
  });

  test('pendingCommitment is set', async () => {
    const f = await createFactory([ALICE, BOB], TOKEN_A, ALICE_BUNDLE);
    expect(typeof f.pendingCommitment).toBe('string');
    expect((f.pendingCommitment ?? '').length).toBeGreaterThan(0);
  });

  test('stateLog has create entry', async () => {
    const f = await createFactory([ALICE, BOB], TOKEN_A, ALICE_BUNDLE);
    expect(f.stateLog[0].event).toBe('create');
  });

  test('fundingTxId is undefined when no chainProvider given', async () => {
    const f = await createFactory([ALICE, BOB], TOKEN_A, ALICE_BUNDLE);
    expect(f.fundingTxId).toBeUndefined();
    expect(f.fundingCoinId).toBeUndefined();
  });

  test('leaseProvider.reserveKeyUse + commitKeyUse called for proposer', async () => {
    const bundle = makeMockBundle(ALICE.publicKeyDigest);
    await createFactory([ALICE, BOB], TOKEN_A, bundle);
    expect(bundle.leaseProvider.reserveKeyUse).toHaveBeenCalledTimes(1);
    expect(bundle.leaseProvider.commitKeyUse).toHaveBeenCalledTimes(1);
  });

  test('throws when fewer than 2 participants', async () => {
    await expect(createFactory([ALICE], TOKEN_A, ALICE_BUNDLE)).rejects.toThrow(/2 participants/);
  });

  test('throws when signer publicKeyDigest not in participants', async () => {
    const strangerBundle = makeMockBundle('0xdeadbeefdeadbeef');
    await expect(
      createFactory([ALICE, BOB], TOKEN_A, strangerBundle),
    ).rejects.toThrow(/does not match/);
  });

  test('conservation holds after creation', async () => {
    checkConservation(await createFactory([ALICE, BOB, CAROL], TOKEN_A, ALICE_BUNDLE));
  });
});

// ─── 4. acceptFactory ─────────────────────────────────────────────────────────

describe('acceptFactory', () => {
  test('partial accept does not change status', async () => {
    const f = await createFactory([ALICE, BOB, CAROL], TOKEN_A, ALICE_BUNDLE);
    const f2 = await acceptFactory(f, BOB_BUNDLE);
    expect(f2.status).toBe('opening');
    expect(f2.pendingSignatures['bob']).toBeInstanceOf(Uint8Array);
  });

  test('all N parties → factory becomes active (2-party)', async () => {
    const f = await createFactory([ALICE, BOB], TOKEN_A, ALICE_BUNDLE);
    const f2 = await acceptFactory(f, BOB_BUNDLE);
    expect(f2.status).toBe('active');
    expect(f2.currentSequence).toBe(1);
    expect(f2.pendingCommitment).toBeUndefined();
    expect(Object.keys(f2.pendingSignatures)).toHaveLength(0);
  });

  test('all N parties → factory becomes active (3-party)', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    expect(f.status).toBe('active');
    expect(f.currentSequence).toBe(1);
  });

  test('stateLog has accept entry after all parties sign', async () => {
    const f = await makeActiveFactory([ALICE, BOB]);
    expect(f.stateLog[1].event).toBe('accept');
  });

  test('leaseProvider called for each acceptFactory party', async () => {
    const f  = await createFactory([ALICE, BOB], TOKEN_A, ALICE_BUNDLE);
    const bobBundle = makeMockBundle(BOB.publicKeyDigest);
    await acceptFactory(f, bobBundle);
    expect(bobBundle.leaseProvider.reserveKeyUse).toHaveBeenCalledTimes(1);
    expect(bobBundle.leaseProvider.commitKeyUse).toHaveBeenCalledTimes(1);
  });

  test('throws when factory is not in opening status', async () => {
    const f = await makeActiveFactory([ALICE, BOB]);
    await expect(acceptFactory(f, BOB_BUNDLE)).rejects.toThrow(/opening/);
  });

  test('throws when signer not in participants', async () => {
    const f = await createFactory([ALICE, BOB], TOKEN_A, ALICE_BUNDLE);
    const strangerBundle = makeMockBundle('0xdeadbeef');
    await expect(acceptFactory(f, strangerBundle)).rejects.toThrow(/does not match/);
  });

  test('throws when party already signed', async () => {
    const f = await createFactory([ALICE, BOB], TOKEN_A, ALICE_BUNDLE);
    await expect(acceptFactory(f, ALICE_BUNDLE)).rejects.toThrow(/already co-signed/);
  });

  test('burnReservation called when verification fails', async () => {
    const f      = await createFactory([ALICE, BOB], TOKEN_A, ALICE_BUNDLE);
    const badBob = makeBadBundle(BOB.publicKeyDigest);
    await expect(acceptFactory(f, badBob)).rejects.toThrow(/verification failed/);
    expect(badBob.leaseProvider.burnReservation).toHaveBeenCalled();
  });

  test('conservation holds after activation', async () => {
    checkConservation(await makeActiveFactory([ALICE, BOB, CAROL]));
  });
});

// ─── 5. reallocate ────────────────────────────────────────────────────────────

describe('reallocate', () => {
  test('updates allocations atomically', async () => {
    const f = await makeActiveFactory([ALICE, BOB]);
    const f2 = await reallocate(f, 'alice', 'bob', 200n, BUNDLES2);
    expect(f2.allocations).toEqual({ alice: 800n, bob: 700n });
    expect(f2.currentSequence).toBe(2);
    checkConservation(f2);
  });

  test('stateLog has reallocate entry', async () => {
    const f  = await makeActiveFactory([ALICE, BOB]);
    const f2 = await reallocate(f, 'alice', 'bob', 100n, BUNDLES2);
    expect(f2.stateLog.at(-1)?.event).toBe('reallocate');
  });

  test('leaseProvider called for each participant', async () => {
    const lp1 = makeMockLeaseProvider();
    const lp2 = makeMockLeaseProvider();
    const bundles: Record<string, WotsLeaseBundle> = {
      alice: { leaseProvider: lp1, signer: makeMockSigner(ALICE.publicKeyDigest), verify: () => true },
      bob:   { leaseProvider: lp2, signer: makeMockSigner(BOB.publicKeyDigest),   verify: () => true },
    };
    const f = await makeActiveFactory([ALICE, BOB]);
    await reallocate(f, 'alice', 'bob', 100n, bundles);
    expect(lp1.reserveKeyUse).toHaveBeenCalledTimes(1);
    expect(lp2.reserveKeyUse).toHaveBeenCalledTimes(1);
  });

  test('throws when from party has insufficient allocation', async () => {
    const f = await makeActiveFactory([ALICE, BOB]);
    await expect(reallocate(f, 'bob', 'alice', 1000n, BUNDLES2)).rejects.toThrow(/Insufficient/);
  });

  test('throws when factory is not active', async () => {
    const f = await createFactory([ALICE, BOB], TOKEN_A, ALICE_BUNDLE);
    await expect(reallocate(f, 'alice', 'bob', 100n, BUNDLES2)).rejects.toThrow(/active/);
  });

  test('throws when to party is not a participant', async () => {
    const f = await makeActiveFactory([ALICE, BOB]);
    await expect(reallocate(f, 'alice', 'dave', 100n, BUNDLES2)).rejects.toThrow(/not a registered/);
  });

  test('throws when amount is zero', async () => {
    const f = await makeActiveFactory([ALICE, BOB]);
    await expect(reallocate(f, 'alice', 'bob', 0n, BUNDLES2)).rejects.toThrow(/positive/);
  });

  test('throws when a leaseProvider bundle is missing', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const partial = { alice: ALICE_BUNDLE, bob: BOB_BUNDLE }; // carol missing
    await expect(reallocate(f, 'alice', 'bob', 100n, partial)).rejects.toThrow(/Missing/);
  });
});

// ─── 6. openVirtualChannel ────────────────────────────────────────────────────

describe('openVirtualChannel', () => {
  test('deducts from participant allocations', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const { factory: f2 } = await openVirtualChannel(
      f, ['alice', 'bob'], { alice: 200n, bob: 100n }, BUNDLES3,
    );
    expect(f2.allocations.alice).toBe(800n);
    expect(f2.allocations.bob).toBe(400n);
    expect(f2.allocations.carol).toBe(500n);
  });

  test('increments currentSequence', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const seq = f.currentSequence;
    const { factory: f2 } = await openVirtualChannel(
      f, ['alice', 'bob'], { alice: 100n, bob: 50n }, BUNDLES3,
    );
    expect(f2.currentSequence).toBe(seq + 1);
  });

  test('conservation holds after opening', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const { factory: f2 } = await openVirtualChannel(
      f, ['alice', 'bob'], { alice: 200n, bob: 100n }, BUNDLES3,
    );
    checkConservation(f2);
  });

  test('returned channel has correct fields', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const { channel } = await openVirtualChannel(
      f, ['alice', 'bob'], { alice: 200n, bob: 100n }, BUNDLES3,
    );
    expect(channel.channelType).toBe('virtual');
    expect(channel.factoryRef).toBe(f.factoryId);
    expect(channel.tokenId).toBe(TOKEN_A);
    expect(channel.totalValue).toBe(300n);
    expect(channel.balances.alice).toBe(200n);
    expect(channel.balances.bob).toBe(100n);
    expect(channel.status).toBe('active');
  });

  test('channel appears in factory.virtualChannels', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const { factory: f2, channel } = await openVirtualChannel(
      f, ['alice', 'bob'], { alice: 200n, bob: 100n }, BUNDLES3,
    );
    expect(f2.virtualChannels).toHaveLength(1);
    expect(f2.virtualChannels[0].channelId).toBe(channel.channelId);
  });

  test('two VCs can be opened simultaneously', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const { factory: f2 } = await openVirtualChannel(
      f, ['alice', 'bob'], { alice: 200n, bob: 100n }, BUNDLES3,
    );
    const { factory: f3 } = await openVirtualChannel(
      f2, ['bob', 'carol'], { bob: 100n, carol: 100n }, BUNDLES3,
    );
    expect(f3.virtualChannels).toHaveLength(2);
    checkConservation(f3);
  });

  test('all N party bundles are invoked (verify-on-sign gate)', async () => {
    const verifyCalls: string[] = [];
    const spyBundles: Record<string, WotsLeaseBundle> = {
      alice: { leaseProvider: makeMockLeaseProvider(), signer: makeMockSigner(ALICE.publicKeyDigest), verify: (_, __, pkd) => { verifyCalls.push(pkd); return true; } },
      bob:   { leaseProvider: makeMockLeaseProvider(), signer: makeMockSigner(BOB.publicKeyDigest),   verify: (_, __, pkd) => { verifyCalls.push(pkd); return true; } },
      carol: { leaseProvider: makeMockLeaseProvider(), signer: makeMockSigner(CAROL.publicKeyDigest), verify: (_, __, pkd) => { verifyCalls.push(pkd); return true; } },
    };
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    await openVirtualChannel(f, ['alice', 'bob'], { alice: 100n, bob: 50n }, spyBundles);
    expect(verifyCalls).toHaveLength(3);
  });

  test('throws when party has insufficient allocation', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    await expect(openVirtualChannel(f, ['bob', 'carol'], { bob: 600n, carol: 100n }, BUNDLES3))
      .rejects.toThrow(/insufficient/i);
  });

  test('throws when factory is not active', async () => {
    const f = await createFactory([ALICE, BOB], TOKEN_A, ALICE_BUNDLE);
    await expect(openVirtualChannel(f, ['alice', 'bob'], { alice: 100n, bob: 50n }, BUNDLES2))
      .rejects.toThrow(/active/);
  });

  test('throws when a leaseProvider bundle is missing', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const partial = { alice: ALICE_BUNDLE, bob: BOB_BUNDLE }; // carol missing
    await expect(openVirtualChannel(f, ['alice', 'bob'], { alice: 100n, bob: 50n }, partial))
      .rejects.toThrow(/Missing/);
  });

  test('throws when verification fails for any party', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const badBundles: Record<string, WotsLeaseBundle> = {
      alice: makeBadBundle(ALICE.publicKeyDigest),
      bob:   makeBadBundle(BOB.publicKeyDigest),
      carol: makeBadBundle(CAROL.publicKeyDigest),
    };
    await expect(openVirtualChannel(f, ['alice', 'bob'], { alice: 100n, bob: 50n }, badBundles))
      .rejects.toThrow(/verification failed/);
  });

  test('custom channelId is respected', async () => {
    const f = await makeActiveFactory([ALICE, BOB]);
    const { channel } = await openVirtualChannel(
      f, ['alice', 'bob'], { alice: 100n, bob: 50n }, BUNDLES2, 'my-vc-id',
    );
    expect(channel.channelId).toBe('my-vc-id');
  });
});

// ─── 7. closeVirtualChannel ───────────────────────────────────────────────────

describe('closeVirtualChannel', () => {
  async function openVC(factory: ChannelFactory) {
    return openVirtualChannel(factory, ['alice', 'bob'], { alice: 200n, bob: 100n }, BUNDLES3);
  }

  test('uses latestState.balances as final allocations when set', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const { factory: f2, channel } = await openVC(f);
    const channelWithState: OmniaChannel = {
      ...channel,
      latestState: { sequence: 1, balances: { alice: 250n, bob: 50n }, pendingHTLCs: [], signatures: {}, signingIndices: {} } as any,
    };
    const f3 = await closeVirtualChannel(f2, channelWithState, BUNDLES3);
    expect(f3.allocations.alice).toBe(1050n);  // 800 + 250
    expect(f3.allocations.bob).toBe(450n);     // 400 + 50
  });

  test('uses initial balances when latestState is null', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const { factory: f2, channel } = await openVC(f);
    // channel.latestState is null by default
    const f3 = await closeVirtualChannel(f2, channel, BUNDLES3);
    expect(f3.allocations.alice).toBe(1000n);  // 800 + 200 (initial)
    expect(f3.allocations.bob).toBe(500n);     // 400 + 100 (initial)
  });

  test('increments currentSequence', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const { factory: f2, channel } = await openVC(f);
    const seqBefore = f2.currentSequence;
    const f3 = await closeVirtualChannel(f2, channel, BUNDLES3);
    expect(f3.currentSequence).toBe(seqBefore + 1);
  });

  test('removes channel from virtualChannels', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const { factory: f2, channel } = await openVC(f);
    const f3 = await closeVirtualChannel(f2, channel, BUNDLES3);
    expect(f3.virtualChannels).toHaveLength(0);
  });

  test('conservation holds after closing', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const { factory: f2, channel } = await openVC(f);
    checkConservation(await closeVirtualChannel(f2, channel, BUNDLES3));
  });

  test('all N party bundles are invoked', async () => {
    const verifyCalls: string[] = [];
    const spyBundles: Record<string, WotsLeaseBundle> = {
      alice: { leaseProvider: makeMockLeaseProvider(), signer: makeMockSigner(ALICE.publicKeyDigest), verify: (_, __, pkd) => { verifyCalls.push(pkd); return true; } },
      bob:   { leaseProvider: makeMockLeaseProvider(), signer: makeMockSigner(BOB.publicKeyDigest),   verify: (_, __, pkd) => { verifyCalls.push(pkd); return true; } },
      carol: { leaseProvider: makeMockLeaseProvider(), signer: makeMockSigner(CAROL.publicKeyDigest), verify: (_, __, pkd) => { verifyCalls.push(pkd); return true; } },
    };
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const { factory: f2, channel } = await openVC(f);
    await closeVirtualChannel(f2, channel, spyBundles);
    expect(verifyCalls).toHaveLength(3);
  });

  test('throws when channelId not found', async () => {
    const f = await makeActiveFactory([ALICE, BOB]);
    const phantom: OmniaChannel = { channelId: 'nonexistent' } as any;
    await expect(closeVirtualChannel(f, phantom, BUNDLES2)).rejects.toThrow(/not found/);
  });

  test('throws when a leaseProvider bundle is missing', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    const { factory: f2, channel } = await openVC(f);
    const partial = { alice: ALICE_BUNDLE, bob: BOB_BUNDLE }; // carol missing
    await expect(closeVirtualChannel(f2, channel, partial)).rejects.toThrow(/Missing/);
  });
});

// ─── 8. Full 3-party lifecycle ────────────────────────────────────────────────

describe('3-party factory lifecycle', () => {
  test('create → activate → open 2 VCs → close VCs → close factory', async () => {
    // Activate
    const f0 = await makeActiveFactory([ALICE, BOB, CAROL]);
    checkConservation(f0);

    // Open two VCs (all 3 parties sign each open)
    const { factory: f1, channel: vc1 } = await openVirtualChannel(
      f0, ['alice', 'bob'], { alice: 200n, bob: 100n }, BUNDLES3,
    );
    const { factory: f2, channel: vc2 } = await openVirtualChannel(
      f1, ['bob', 'carol'], { bob: 100n, carol: 100n }, BUNDLES3,
    );
    expect(f2.virtualChannels).toHaveLength(2);
    checkConservation(f2);
    expect(f2.allocations.alice).toBe(800n);
    expect(f2.allocations.bob).toBe(300n);
    expect(f2.allocations.carol).toBe(400n);
    expect(f2.currentSequence).toBe(f0.currentSequence + 2);

    // Close VC1 with net transfer alice→bob
    const vc1Final: OmniaChannel = {
      ...vc1,
      latestState: { sequence: 1, balances: { alice: 150n, bob: 150n }, pendingHTLCs: [], signatures: {}, signingIndices: {} } as any,
    };
    const f3 = await closeVirtualChannel(f2, vc1Final, BUNDLES3);

    // Close VC2 with net transfer bob→carol
    const vc2Final: OmniaChannel = {
      ...vc2,
      latestState: { sequence: 1, balances: { bob: 70n, carol: 130n }, pendingHTLCs: [], signatures: {}, signingIndices: {} } as any,
    };
    const f4 = await closeVirtualChannel(f3, vc2Final, BUNDLES3);
    expect(f4.virtualChannels).toHaveLength(0);
    checkConservation(f4);

    // Verify final allocations
    expect(f4.allocations.alice).toBe(950n);  // 800 + 150
    expect(f4.allocations.bob).toBe(520n);    // 300 + 150 + 70
    expect(f4.allocations.carol).toBe(530n);  // 400 + 130
    expect(f4.allocations.alice + f4.allocations.bob + f4.allocations.carol).toBe(2000n);
    expect(f4.currentSequence).toBe(f0.currentSequence + 4);

    // Cooperative close
    const settlement = await closeFactory(withFundingCoinId(f4), BUNDLES3);
    expect(settlement.factoryId).toBe(f4.factoryId);
    expect(settlement.settlementTxHex.length).toBeGreaterThan(0);
    expect(settlement.finalAllocations).toEqual(f4.allocations);
  });

  test('sequence is monotonically increasing across all state transitions', async () => {
    const f0 = await makeActiveFactory([ALICE, BOB, CAROL]); // seq=1
    expect(f0.currentSequence).toBe(1);

    const { factory: f1 } = await openVirtualChannel(
      f0, ['alice', 'bob'], { alice: 100n, bob: 50n }, BUNDLES3,
    );
    expect(f1.currentSequence).toBe(2);

    const f2 = await reallocate(f1, 'carol', 'alice', 100n, BUNDLES3);
    expect(f2.currentSequence).toBe(3);

    const f3 = await closeVirtualChannel(f2, f1.virtualChannels[0], BUNDLES3);
    expect(f3.currentSequence).toBe(4);
  });

  test('conservation is maintained across all operations', async () => {
    const f0 = await makeActiveFactory([ALICE, BOB, CAROL]);
    checkConservation(f0);

    const { factory: f1, channel: vc } = await openVirtualChannel(
      f0, ['alice', 'carol'], { alice: 500n, carol: 200n }, BUNDLES3,
    );
    checkConservation(f1);

    const f2 = await reallocate(f1, 'bob', 'carol', 100n, BUNDLES3);
    checkConservation(f2);

    const vcWithFinal: OmniaChannel = {
      ...vc,
      latestState: { sequence: 1, balances: { alice: 400n, carol: 300n }, pendingHTLCs: [], signatures: {}, signingIndices: {} } as any,
    };
    const f3 = await closeVirtualChannel(f2, vcWithFinal, BUNDLES3);
    checkConservation(f3);
  });
});

// ─── 9. closeFactory ─────────────────────────────────────────────────────────

describe('closeFactory', () => {
  test('returns correct settlement payload', async () => {
    const f = withFundingCoinId(await makeActiveFactory([ALICE, BOB]));
    const s = await closeFactory(f, BUNDLES2);
    expect(s.factoryId).toBe(f.factoryId);
    expect(s.finalAllocations).toEqual({ alice: 1000n, bob: 500n });
    expect(s.settlementTxHex.length).toBeGreaterThan(0);
  });

  test('settlementTxHex is a non-empty string (serializeTxDraft output)', async () => {
    const f = withFundingCoinId(await makeActiveFactory([ALICE, BOB]));
    const s = await closeFactory(f, BUNDLES2);
    expect(typeof s.settlementTxHex).toBe('string');
  });

  test('no txpowId when chainProvider omitted', async () => {
    const f = withFundingCoinId(await makeActiveFactory([ALICE, BOB]));
    expect((await closeFactory(f, BUNDLES2)).txpowId).toBeUndefined();
  });

  test('all N party settlement signers are invoked', async () => {
    const verifyCalls: string[] = [];
    const spyBundles: Record<string, WotsLeaseBundle> = {
      alice: { leaseProvider: makeMockLeaseProvider(), signer: makeMockSigner(ALICE.publicKeyDigest), verify: (_, __, pkd) => { verifyCalls.push(pkd); return true; } },
      bob:   { leaseProvider: makeMockLeaseProvider(), signer: makeMockSigner(BOB.publicKeyDigest),   verify: (_, __, pkd) => { verifyCalls.push(pkd); return true; } },
    };
    const f = withFundingCoinId(await makeActiveFactory([ALICE, BOB]));
    await closeFactory(f, spyBundles);
    expect(verifyCalls).toHaveLength(2);
  });

  test('throws when settlement signature verification fails', async () => {
    const f = withFundingCoinId(await makeActiveFactory([ALICE, BOB]));
    const badBundles: Record<string, WotsLeaseBundle> = {
      alice: makeBadBundle(ALICE.publicKeyDigest),
      bob:   makeBadBundle(BOB.publicKeyDigest),
    };
    await expect(closeFactory(f, badBundles)).rejects.toThrow(/verification failed/);
  });

  test('throws (fail-fast) when fundingCoinId is absent', async () => {
    const f = await makeActiveFactory([ALICE, BOB]);
    // fundingCoinId is undefined by default (no chainProvider in test)
    await expect(closeFactory(f, BUNDLES2)).rejects.toThrow(/fundingCoinId/);
  });

  test('throws when a leaseProvider bundle is missing', async () => {
    const f = withFundingCoinId(await makeActiveFactory([ALICE, BOB, CAROL]));
    await expect(closeFactory(f, BUNDLES2)).rejects.toThrow(/Missing/);
  });

  test('throws when virtual channels are still open', async () => {
    const f = await makeActiveFactory([ALICE, BOB]);
    const { factory: f2 } = await openVirtualChannel(
      f, ['alice', 'bob'], { alice: 100n, bob: 50n }, BUNDLES2,
    );
    await expect(closeFactory(withFundingCoinId(f2), BUNDLES2)).rejects.toThrow(/virtual channels/);
  });

  test('throws when factory is not active', async () => {
    const f = await createFactory([ALICE, BOB], TOKEN_A, ALICE_BUNDLE);
    await expect(closeFactory(withFundingCoinId(f), BUNDLES2)).rejects.toThrow(/active/);
  });
});

// ─── 10. buildDisputePayload ──────────────────────────────────────────────────

describe('buildDisputePayload', () => {
  test('includes stateLog with dispute entry appended', async () => {
    const f = await makeActiveFactory([ALICE, BOB]);
    const { factory: f2 } = await openVirtualChannel(
      f, ['alice', 'bob'], { alice: 100n, bob: 50n }, BUNDLES2,
    );
    const dispute = buildDisputePayload(f2, '0xevidence');
    expect(dispute.factoryId).toBe(f2.factoryId);
    expect(dispute.latestSequence).toBe(f2.currentSequence);
    expect(dispute.stateLog.at(-1)?.event).toBe('dispute');
    expect(dispute.virtualChannelIds).toHaveLength(1);
    expect(dispute.evidence).toBe('0xevidence');
  });

  test('allocations match factory', async () => {
    const f = await makeActiveFactory([ALICE, BOB, CAROL]);
    expect(buildDisputePayload(f, 'e').allocations).toEqual(f.allocations);
  });

  test('works on a factory still in opening status (no restriction)', async () => {
    const f = await createFactory([ALICE, BOB], TOKEN_A, ALICE_BUNDLE);
    const dispute = buildDisputePayload(f, 'emergency');
    expect(dispute.latestSequence).toBe(0);
    expect(dispute.stateLog.at(-1)?.event).toBe('dispute');
  });
});

// ─── 11. enforceConservation ──────────────────────────────────────────────────

describe('enforceConservation', () => {
  test('passes for a valid factory', async () => {
    const f = await makeActiveFactory([ALICE, BOB]);
    expect(() => enforceConservation(f)).not.toThrow();
  });

  test('throws when allocations are corrupted', async () => {
    const f = await makeActiveFactory([ALICE, BOB]);
    const broken: ChannelFactory = { ...f, allocations: { alice: 9999n, bob: 500n } };
    expect(() => enforceConservation(broken)).toThrow(/conservation/);
  });
});
