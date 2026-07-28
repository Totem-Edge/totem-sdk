import { sha3_256 } from '@totemsdk/core';
import { MAX_HASH } from '@totemsdk/txpow';
import type { OmniaChannel, ChannelSigner } from '@totemsdk/omnia';
import { _resetChannelWatermarks, COINID_ELTOO } from '@totemsdk/omnia';
import type { SigningIndices, WotsLeaseProvider } from '@totemsdk/wots-lease';
import {
  quiesceChannel,
  buildSpliceTx,
  computeSpliceTxDigest,
  spliceDraftToMinimaBytes,
  proposeSpliceIn,
  proposeSpliceOut,
  acceptSplice,
  finalizeSplice,
  PendingHTLCError,
  SpliceChannelStatusError,
  SpliceBalanceConservationError,
  SpliceInsufficientFundsError,
  SpliceMissingPartyError,
  SpliceSignatureMismatchError,
  type SpliceLeaseProvider,
  type SpliceParams,
  type QuiescedChannel,
  type QuiesceOptions,
} from '../index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Mock sig verifier: matches sig = sha3_256(pkd_bytes || payload) from makeSigner
// ─────────────────────────────────────────────────────────────────────────────

function mockVerifySignature(sig: Uint8Array, digest: Uint8Array, pkd: string): boolean {
  const expected = sha3_256(
    new Uint8Array([...Buffer.from(pkd.slice(2), 'hex'), ...digest]),
  );
  return expected.length === sig.length && expected.every((b, i) => b === sig[i]);
}

const TEST_MINE_OPTS = { mineDifficulty: MAX_HASH, verifySignature: mockVerifySignature };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PKD_ALICE = '0x' + 'aa'.repeat(32);
const PKD_BOB   = '0x' + 'bb'.repeat(32);
const FUNDING_COIN_ID  = '0x' + 'cc'.repeat(32);
const FUNDING_ADDRESS  = '0x' + 'dd'.repeat(32);
const EXTRA_ADDRESS    = '0x' + 'ee'.repeat(32);
const THIRD_PARTY_ADDR = '0x' + 'ff'.repeat(32);
const NEW_COIN_ID      = '0x' + '11'.repeat(32);
const NEW_COIN_ADDR    = '0x' + '22'.repeat(32);
const TOKEN_ID         = '0x00';

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
    reserveKeyUse: jest.fn(async (_params) => {
      const idx = ++counter;
      return {
        reservationId: `test-res-${idx}`,
        indices: { l1: idx, l2: 0, addressIndex: 0 },
        expiresAt: Date.now() + 3_600_000,
      };
    }),
    commitKeyUse:      jest.fn(async (_id, _txId) => {}),
    burnReservation:   jest.fn(async (_id, _reason) => {}),
    getLocalWatermark: jest.fn(async (treeId) => ({
      treeId, addressCursor: 0, l1Cursor: 0, l2Cursor: 0, unavailableCount: 0, capacity: 4096,
    })),
    publishWatermark:        jest.fn(async (_treeId) => {}),
    syncLeaseJournal:        jest.fn(async () => ({ synced: true, conflicts: [] })),
    verifyLeaseCertificate:  jest.fn(async (_cert) => true),
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
    fundingAddress: FUNDING_ADDRESS,
    tokenId: TOKEN_ID,
    tokenScale: 0,
    totalValue: 1000n,
    parties: [
      { partyId: 'alice', publicKeyDigest: PKD_ALICE, addressIndex: 0 },
      { partyId: 'bob',   publicKeyDigest: PKD_BOB,   addressIndex: 1 },
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
  };
}

async function quiesce(ch: OmniaChannel): Promise<QuiescedChannel> {
  return quiesceChannel(ch, makeLeaseProvider(PKD_ALICE));
}

// ─────────────────────────────────────────────────────────────────────────────
// quiesceChannel
// ─────────────────────────────────────────────────────────────────────────────

describe('quiesceChannel', () => {
  beforeEach(() => { _resetChannelWatermarks(); });

  it('returns a quiesced channel when no HTLCs are pending', async () => {
    const q = await quiesce(makeChannel());
    expect(q.status).toBe('quiesced');
    expect(q.pendingHTLCs).toHaveLength(0);
  });

  it('populates quiesceSignedState with local party partial signature', async () => {
    const ch = makeChannel();
    const q = await quiesce(ch);
    expect(q.quiesceSignedState).toBeDefined();
    expect(q.quiesceSignedState.sequence).toBe(ch.currentSequence + 1);
    expect(q.quiesceSignedState.balances).toEqual(ch.balances);
  });

  it('clears all resolved HTLCs', async () => {
    const ch = makeChannel({
      pendingHTLCs: [
        {
          htlcId: '0x01', amount: 100n, hashlock: '0x' + 'aa'.repeat(32),
          timeoutBlock: 1000n, direction: 'offered', status: 'fulfilled',
          htlcAddress: '0x' + 'ab'.repeat(32),
          senderPublicKeyDigest: PKD_ALICE, recipientPublicKeyDigest: PKD_BOB,
        },
        {
          htlcId: '0x02', amount: 50n, hashlock: '0x' + 'bb'.repeat(32),
          timeoutBlock: 1000n, direction: 'received', status: 'timed_out',
          htlcAddress: '0x' + 'bc'.repeat(32),
          senderPublicKeyDigest: PKD_BOB, recipientPublicKeyDigest: PKD_ALICE,
        },
      ],
    });
    const q = await quiesce(ch);
    expect(q.status).toBe('quiesced');
    expect(q.pendingHTLCs).toHaveLength(0);
  });

  it('throws PendingHTLCError if any HTLC is still pending', async () => {
    const ch = makeChannel({
      pendingHTLCs: [{
        htlcId: '0x01', amount: 100n, hashlock: '0x' + 'aa'.repeat(32),
        timeoutBlock: 1000n, direction: 'offered', status: 'pending',
        htlcAddress: '0x' + 'ab'.repeat(32),
        senderPublicKeyDigest: PKD_ALICE, recipientPublicKeyDigest: PKD_BOB,
      }],
    });
    const lp = makeLeaseProvider(PKD_ALICE);
    await expect(quiesceChannel(ch, lp)).rejects.toThrow(PendingHTLCError);
    await expect(quiesceChannel(ch, lp)).rejects.toThrow('1 HTLC(s) still pending');
  });

  it('throws SpliceChannelStatusError if channel is not active', async () => {
    const lp = makeLeaseProvider(PKD_ALICE);
    await expect(quiesceChannel(makeChannel({ status: 'closing_mutual' }), lp))
      .rejects.toThrow(SpliceChannelStatusError);
    await expect(quiesceChannel(makeChannel({ status: 'closing_mutual' }), lp))
      .rejects.toThrow("'active'");
  });

  it('throws SpliceChannelStatusError if channel is closed', async () => {
    const lp = makeLeaseProvider(PKD_ALICE);
    await expect(quiesceChannel(makeChannel({ status: 'closed' }), lp))
      .rejects.toThrow(SpliceChannelStatusError);
  });

  it('awaitResolution: calls callback with pending HTLCs and succeeds after resolution', async () => {
    const htlc = {
      htlcId: '0x01', amount: 100n, hashlock: '0x' + 'aa'.repeat(32),
      timeoutBlock: 1000n, direction: 'offered' as const, status: 'pending' as const,
      htlcAddress: '0x' + 'ab'.repeat(32),
      senderPublicKeyDigest: PKD_ALICE, recipientPublicKeyDigest: PKD_BOB,
    };
    const ch = makeChannel({ pendingHTLCs: [htlc] });
    const lp = makeLeaseProvider(PKD_ALICE);
    const resolveFn = jest.fn(async (pending: OmniaChannel['pendingHTLCs']) => {
      expect(pending).toHaveLength(1);
      expect(pending[0].htlcId).toBe('0x01');
      ch.pendingHTLCs[0] = { ...ch.pendingHTLCs[0], status: 'fulfilled' };
    });
    const q = await quiesceChannel(ch, lp, { awaitResolution: resolveFn } satisfies QuiesceOptions);
    expect(resolveFn).toHaveBeenCalledTimes(1);
    expect(q.status).toBe('quiesced');
    expect(q.pendingHTLCs).toHaveLength(0);
  });

  it('awaitResolution: still throws PendingHTLCError if HTLCs unresolved after callback', async () => {
    const htlc = {
      htlcId: '0x01', amount: 100n, hashlock: '0x' + 'aa'.repeat(32),
      timeoutBlock: 1000n, direction: 'offered' as const, status: 'pending' as const,
      htlcAddress: '0x' + 'ab'.repeat(32),
      senderPublicKeyDigest: PKD_ALICE, recipientPublicKeyDigest: PKD_BOB,
    };
    const ch = makeChannel({ pendingHTLCs: [htlc] });
    const lp = makeLeaseProvider(PKD_ALICE);
    await expect(
      quiesceChannel(ch, lp, { awaitResolution: async () => {} }),
    ).rejects.toThrow(PendingHTLCError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSpliceTx
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSpliceTx', () => {
  it('splice-in: 2 inputs, channel uses COINID_ELTOO floating input; additional uses specific coinId', () => {
    const ch = makeChannel();
    const draft = buildSpliceTx(ch, {
      type: 'splice_in', newTotalValue: 1500n,
      newBalances: { alice: 900n, bob: 600n },
      additionalCoinId: NEW_COIN_ID, additionalAmount: 500n,
    });
    expect(draft.inputs).toHaveLength(2);
    expect(draft.inputs[0].coinId).toBe(COINID_ELTOO);
    expect(draft.inputs[0].amount).toBe(1000n);
    expect(draft.inputs[1].coinId).toBe(NEW_COIN_ID);
    expect(draft.inputs[1].amount).toBe(500n);
    expect(draft.outputs).toHaveLength(1);
    expect(draft.outputs[0].amount).toBe(1500n);
    expect(draft.outputs[0].storeState).toBe(true);
    expect(draft.outputs[0].stateVarSettlement).toBe(false);
    expect(draft.outputs[0].stateVarSequence).toBe(0);
  });

  it('channel input always uses COINID_ELTOO regardless of latestCoinId', () => {
    const latest = '0x' + '99'.repeat(32);
    const draft = buildSpliceTx(
      { ...makeChannel(), latestCoinId: latest } as OmniaChannel,
      { type: 'splice_in', newTotalValue: 1200n, newBalances: { alice: 700n, bob: 500n }, additionalCoinId: NEW_COIN_ID, additionalAmount: 200n },
    );
    expect(draft.inputs[0].coinId).toBe(COINID_ELTOO);
  });

  it('splice-out: 1 input, channel-coin + withdrawal outputs', () => {
    const draft = buildSpliceTx(makeChannel(), {
      type: 'splice_out', newTotalValue: 800n, newBalances: { alice: 480n, bob: 320n },
      withdrawAmount: 200n, withdrawAddress: EXTRA_ADDRESS,
    });
    expect(draft.inputs).toHaveLength(1);
    expect(draft.outputs).toHaveLength(2);
    expect(draft.outputs[0].amount).toBe(800n);
    expect(draft.outputs[0].storeState).toBe(true);
    expect(draft.outputs[0].stateVarSequence).toBe(0);
    expect(draft.outputs[1].address).toBe(EXTRA_ADDRESS);
    expect(draft.outputs[1].amount).toBe(200n);
    expect(draft.outputs[1].storeState).toBe(false);
  });

  it('splice-out with extra outputs', () => {
    const draft = buildSpliceTx(makeChannel(), {
      type: 'splice_out', newTotalValue: 750n, newBalances: { alice: 450n, bob: 300n },
      withdrawAmount: 200n, withdrawAddress: EXTRA_ADDRESS,
      extraOutputs: [{ address: THIRD_PARTY_ADDR, amount: 50n }],
    });
    expect(draft.outputs).toHaveLength(3);
    expect(draft.outputs[2].address).toBe(THIRD_PARTY_ADDR);
    expect(draft.outputs[2].amount).toBe(50n);
  });

  it('throws SpliceBalanceConservationError when newBalances do not sum to newTotalValue', () => {
    expect(() => buildSpliceTx(makeChannel(), {
      type: 'splice_in', newTotalValue: 1500n, newBalances: { alice: 900n, bob: 400n },
      additionalCoinId: NEW_COIN_ID, additionalAmount: 500n,
    })).toThrow(SpliceBalanceConservationError);
  });

  it('throws SpliceInsufficientFundsError when splice-out exceeds channel total', () => {
    expect(() => buildSpliceTx(makeChannel(), {
      type: 'splice_out', newTotalValue: 0n, newBalances: {},
      withdrawAmount: 2000n, withdrawAddress: EXTRA_ADDRESS,
    })).toThrow(SpliceInsufficientFundsError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeSpliceTxDigest + spliceDraftToMinimaBytes
// ─────────────────────────────────────────────────────────────────────────────

describe('computeSpliceTxDigest', () => {
  it('returns a 32-byte deterministic digest', () => {
    const ch = makeChannel();
    const draft = buildSpliceTx(ch, {
      type: 'splice_in', newTotalValue: 1500n, newBalances: { alice: 900n, bob: 600n },
      additionalCoinId: NEW_COIN_ID, additionalAmount: 500n,
    });
    const d1 = computeSpliceTxDigest(draft);
    const d2 = computeSpliceTxDigest(draft);
    expect(d1).toHaveLength(32);
    expect(d1).toEqual(d2);
  });

  it('different newBalances produce different digests even with same sum', () => {
    const ch = makeChannel();
    const d1 = computeSpliceTxDigest(buildSpliceTx(ch, {
      type: 'splice_in', newTotalValue: 1500n, newBalances: { alice: 900n, bob: 600n },
      additionalCoinId: NEW_COIN_ID, additionalAmount: 500n,
    }));
    const d2 = computeSpliceTxDigest(buildSpliceTx(ch, {
      type: 'splice_in', newTotalValue: 1500n, newBalances: { alice: 800n, bob: 700n },
      additionalCoinId: NEW_COIN_ID, additionalAmount: 500n,
    }));
    expect(d1).not.toEqual(d2);
  });

  it('spliceDraftToMinimaBytes returns non-empty Uint8Array', () => {
    const bytes = spliceDraftToMinimaBytes(buildSpliceTx(makeChannel(), {
      type: 'splice_out', newTotalValue: 800n, newBalances: { alice: 480n, bob: 320n },
      withdrawAmount: 200n, withdrawAddress: EXTRA_ADDRESS,
    }));
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes).toBeInstanceOf(Uint8Array);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// proposeSpliceIn
// ─────────────────────────────────────────────────────────────────────────────

describe('proposeSpliceIn', () => {
  beforeEach(() => { _resetChannelWatermarks(); });

  it('returns SpliceProposal with spliceTxHex, lease reservation data, and proposer signature', async () => {
    const q = await quiesce(makeChannel());
    const lp = makeLeaseProvider(PKD_ALICE);
    const proposal = await proposeSpliceIn(q, NEW_COIN_ID, 500n, lp, { alice: 900n, bob: 600n });
    expect(proposal.proposerPublicKeyDigest).toBe(PKD_ALICE);
    expect(proposal.proposerSignature).toBeInstanceOf(Uint8Array);
    expect(proposal.proposerSignature.length).toBe(32);
    expect(proposal.params.type).toBe('splice_in');
    expect(proposal.params.newTotalValue).toBe(1500n);
    expect(proposal.spliceTxHex).toMatch(/^[0-9a-f]+$/);
    expect(proposal.spliceTxDraft.inputs).toHaveLength(2);
    expect(proposal.proposerReservationId).toBeTruthy();
    expect(proposal.proposerSigningIndices).toBeDefined();
    expect(proposal.proposerSigningIndices.l1).toBeGreaterThan(0);
  });

  it('reserves a WOTS key slot via wotsLease.reserveKeyUse', async () => {
    const q = await quiesce(makeChannel());
    const lp = makeLeaseProvider(PKD_ALICE);
    await proposeSpliceIn(q, NEW_COIN_ID, 500n, lp, { alice: 900n, bob: 600n });
    expect(lp.wotsLease.reserveKeyUse).toHaveBeenCalledWith(
      expect.objectContaining({
        treeId: PKD_ALICE,
        purpose: 'omnia-splice-propose',
      }),
    );
  });

  it('signs with the reserved indices (not hardcoded zeros)', async () => {
    const q = await quiesce(makeChannel());
    const lp = makeLeaseProvider(PKD_ALICE);
    const proposal = await proposeSpliceIn(q, NEW_COIN_ID, 500n, lp, { alice: 900n, bob: 600n });
    expect(proposal.proposerSigningIndices.l1).not.toBe(0);
  });

  it('either party can be the proposer', async () => {
    const q = await quiesce(makeChannel());
    const lp = makeLeaseProvider(PKD_BOB);
    const proposal = await proposeSpliceIn(q, NEW_COIN_ID, 500n, lp, { alice: 900n, bob: 600n });
    expect(proposal.proposerPublicKeyDigest).toBe(PKD_BOB);
  });

  it('omitting newBalances scales balances proportionally to new total', async () => {
    const q = await quiesce(makeChannel());
    const proposal = await proposeSpliceIn(q, NEW_COIN_ID, 500n, makeLeaseProvider(PKD_ALICE));
    const newTotal = 1500n;
    const balanceSum = Object.values(proposal.params.newBalances).reduce((a, b) => a + b, 0n);
    expect(balanceSum).toBe(newTotal);
    expect(proposal.params.newTotalValue).toBe(newTotal);
  });

  it('throws SpliceChannelStatusError if channel is not quiesced', async () => {
    const lp = makeLeaseProvider(PKD_ALICE);
    await expect(
      proposeSpliceIn(makeChannel(), NEW_COIN_ID, 500n, lp, { alice: 900n, bob: 600n }),
    ).rejects.toThrow(SpliceChannelStatusError);
  });

  it('throws SpliceMissingPartyError if signer is not in channel', async () => {
    const q = await quiesce(makeChannel());
    const stranger = makeLeaseProvider('0x' + '55'.repeat(32));
    await expect(
      proposeSpliceIn(q, NEW_COIN_ID, 500n, stranger, { alice: 900n, bob: 600n }),
    ).rejects.toThrow(SpliceMissingPartyError);
  });

  it('throws PendingHTLCError (defense-in-depth) on quiesced channel with pending HTLC', async () => {
    const fakeQ: QuiescedChannel = {
      ...makeChannel({
        pendingHTLCs: [{
          htlcId: '0x01', amount: 100n, hashlock: '0x' + 'aa'.repeat(32),
          timeoutBlock: 1000n, direction: 'offered', status: 'pending',
          htlcAddress: '0x' + 'ab'.repeat(32),
          senderPublicKeyDigest: PKD_ALICE, recipientPublicKeyDigest: PKD_BOB,
        }],
      }),
      status: 'quiesced',
      quiesceSignedState: {},
    };
    await expect(
      proposeSpliceIn(fakeQ, NEW_COIN_ID, 500n, makeLeaseProvider(PKD_ALICE), { alice: 900n, bob: 600n }),
    ).rejects.toThrow(PendingHTLCError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// proposeSpliceOut
// ─────────────────────────────────────────────────────────────────────────────

describe('proposeSpliceOut', () => {
  beforeEach(() => { _resetChannelWatermarks(); });

  it('returns SpliceProposal for splice-out with lease reservation data', async () => {
    const q = await quiesce(makeChannel());
    const lp = makeLeaseProvider(PKD_ALICE);
    const proposal = await proposeSpliceOut(q, 200n, EXTRA_ADDRESS, lp, { alice: 480n, bob: 320n });
    expect(proposal.params.type).toBe('splice_out');
    expect(proposal.params.newTotalValue).toBe(800n);
    expect(proposal.spliceTxHex).toMatch(/^[0-9a-f]+$/);
    expect(proposal.proposerReservationId).toBeTruthy();
    expect(proposal.proposerSigningIndices).toBeDefined();
  });

  it('combined splice-out + third-party payment', async () => {
    const q = await quiesce(makeChannel());
    const proposal = await proposeSpliceOut(
      q, 200n, EXTRA_ADDRESS, makeLeaseProvider(PKD_ALICE),
      { alice: 450n, bob: 300n }, [{ address: THIRD_PARTY_ADDR, amount: 50n }],
    );
    expect(proposal.params.newTotalValue).toBe(750n);
    expect(proposal.spliceTxDraft.outputs).toHaveLength(3);
  });

  it('throws SpliceChannelStatusError if channel is not quiesced', async () => {
    await expect(
      proposeSpliceOut(makeChannel(), 200n, EXTRA_ADDRESS, makeLeaseProvider(PKD_ALICE), { alice: 480n, bob: 320n }),
    ).rejects.toThrow(SpliceChannelStatusError);
  });

  it('throws SpliceChannelStatusError if channel is already spliced', async () => {
    const ch = makeChannel({ status: 'spliced' });
    await expect(
      proposeSpliceOut(ch, 200n, EXTRA_ADDRESS, makeLeaseProvider(PKD_ALICE), { alice: 480n, bob: 320n }),
    ).rejects.toThrow(SpliceChannelStatusError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// acceptSplice
// ─────────────────────────────────────────────────────────────────────────────

describe('acceptSplice', () => {
  beforeEach(() => { _resetChannelWatermarks(); });

  async function makeProposal() {
    const ch = makeChannel();
    const q = await quiesce(ch);
    const proposal = await proposeSpliceIn(q, NEW_COIN_ID, 500n, makeLeaseProvider(PKD_ALICE), { alice: 900n, bob: 600n });
    return { ch, q, proposal };
  }

  it('returns SpliceAcceptance with co-signature and lease reservation data', async () => {
    const { q, proposal } = await makeProposal();
    const bobLp = makeLeaseProvider(PKD_BOB);
    const acceptance = await acceptSplice(q, proposal, bobLp);
    expect(acceptance.spliceId).toBe(proposal.spliceId);
    expect(acceptance.channelId).toBe(q.channelId);
    expect(acceptance.acceptorPublicKeyDigest).toBe(PKD_BOB);
    expect(acceptance.acceptorSignature).toBeInstanceOf(Uint8Array);
    expect(acceptance.acceptorReservationId).toBeTruthy();
    expect(acceptance.acceptorSigningIndices).toBeDefined();
    expect(acceptance.acceptorSigningIndices.l1).toBeGreaterThan(0);
  });

  it('reserves a WOTS key slot for acceptor via wotsLease.reserveKeyUse', async () => {
    const { q, proposal } = await makeProposal();
    const bobLp = makeLeaseProvider(PKD_BOB);
    await acceptSplice(q, proposal, bobLp);
    expect(bobLp.wotsLease.reserveKeyUse).toHaveBeenCalledWith(
      expect.objectContaining({
        treeId: PKD_BOB,
        purpose: 'omnia-splice-accept',
      }),
    );
  });

  it('acceptor signs with reserved indices (not hardcoded zeros)', async () => {
    const { q, proposal } = await makeProposal();
    const acceptance = await acceptSplice(q, proposal, makeLeaseProvider(PKD_BOB));
    expect(acceptance.acceptorSigningIndices.l1).not.toBe(0);
  });

  it('throws SpliceChannelStatusError if channel is not quiesced', async () => {
    const { ch, proposal } = await makeProposal();
    await expect(acceptSplice(ch, proposal, makeLeaseProvider(PKD_BOB)))
      .rejects.toThrow(SpliceChannelStatusError);
  });

  it('throws if acceptor is the same party as proposer', async () => {
    const { q, proposal } = await makeProposal();
    await expect(acceptSplice(q, proposal, makeLeaseProvider(PKD_ALICE)))
      .rejects.toThrow('Acceptor and proposer cannot be the same party');
  });

  it('throws if channelId in proposal does not match channel', async () => {
    const { proposal } = await makeProposal();
    const fakeQ: QuiescedChannel = { ...makeChannel({ channelId: '0xdeadbeef' }), status: 'quiesced', quiesceSignedState: {} };
    await expect(acceptSplice(fakeQ, proposal, makeLeaseProvider(PKD_BOB)))
      .rejects.toThrow('does not match channel');
  });

  it('throws SpliceMissingPartyError if acceptor is not in the channel', async () => {
    const { q, proposal } = await makeProposal();
    await expect(acceptSplice(q, proposal, makeLeaseProvider('0x' + '77'.repeat(32))))
      .rejects.toThrow(SpliceMissingPartyError);
  });

  it('acceptor signs the same digest as proposer', async () => {
    const { q, proposal } = await makeProposal();
    const bobLp = makeLeaseProvider(PKD_BOB);
    const acceptance = await acceptSplice(q, proposal, bobLp);
    const digest = computeSpliceTxDigest(proposal.spliceTxDraft);
    const expectedSig = sha3_256(
      new Uint8Array([...Buffer.from(PKD_BOB.slice(2), 'hex'), ...digest]),
    );
    expect(acceptance.acceptorSignature).toEqual(expectedSig);
  });

  it('rejects proposal with tampered newBalances (conservation check)', async () => {
    const { q, proposal } = await makeProposal();
    const tampered = { ...proposal, params: { ...proposal.params, newBalances: { alice: 800n, bob: 600n } } };
    await expect(acceptSplice(q, tampered, makeLeaseProvider(PKD_BOB)))
      .rejects.toThrow('Proposal integrity check failed');
  });

  it('rejects proposal whose spliceTxDraft does not match params (tamper detection)', async () => {
    const q = await quiesce(makeChannel());
    const aliceLp = makeLeaseProvider(PKD_ALICE);
    const p1 = await proposeSpliceIn(q, NEW_COIN_ID, 500n, aliceLp, { alice: 900n, bob: 600n });
    const p2 = await proposeSpliceIn(q, NEW_COIN_ID, 600n, aliceLp, { alice: 960n, bob: 640n });
    const tampered = { ...p1, spliceTxDraft: p2.spliceTxDraft };
    await expect(acceptSplice(q, tampered, makeLeaseProvider(PKD_BOB)))
      .rejects.toThrow('inconsistent');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// finalizeSplice
// ─────────────────────────────────────────────────────────────────────────────

describe('finalizeSplice', () => {
  beforeEach(() => { _resetChannelWatermarks(); });

  async function fullSpliceIn(additionalAmount = 500n) {
    const ch = makeChannel();
    const q = await quiesce(ch);
    const aliceLp = makeLeaseProvider(PKD_ALICE);
    const bobLp   = makeLeaseProvider(PKD_BOB);
    const newBalances = {
      alice: 600n + additionalAmount * 6n / 10n,
      bob:   400n + additionalAmount * 4n / 10n,
    };
    const proposal   = await proposeSpliceIn(q, NEW_COIN_ID, additionalAmount, aliceLp, newBalances);
    const acceptance = await acceptSplice(q, proposal, bobLp);
    const MINE_OPTS = {
      ...TEST_MINE_OPTS,
      proposerLeaseProvider: aliceLp.wotsLease,
      acceptorLeaseProvider: bobLp.wotsLease,
    };
    return { ch, q, proposal, acceptance, aliceLp, bobLp, MINE_OPTS };
  }

  async function fullSpliceOut(withdrawAmount = 200n) {
    const ch = makeChannel();
    const q = await quiesce(ch);
    const aliceLp = makeLeaseProvider(PKD_ALICE);
    const bobLp   = makeLeaseProvider(PKD_BOB);
    const remaining = 1000n - withdrawAmount;
    const newBalances = { alice: remaining * 6n / 10n, bob: remaining - (remaining * 6n / 10n) };
    const proposal   = await proposeSpliceOut(q, withdrawAmount, EXTRA_ADDRESS, aliceLp, newBalances);
    const acceptance = await acceptSplice(q, proposal, bobLp);
    const MINE_OPTS = {
      ...TEST_MINE_OPTS,
      proposerLeaseProvider: aliceLp.wotsLease,
      acceptorLeaseProvider: bobLp.wotsLease,
    };
    return { ch, q, proposal, acceptance, aliceLp, bobLp, MINE_OPTS };
  }

  it('splice-in: SplicedChannel status active, correct totalValue, sequence 0', async () => {
    const { ch, q, proposal, acceptance, MINE_OPTS } = await fullSpliceIn(500n);
    const spliced = await finalizeSplice(q, proposal, acceptance, MINE_OPTS);
    expect(spliced.status).toBe('active');
    expect(spliced.totalValue).toBe(1500n);
    expect(spliced.currentSequence).toBe(0);
    expect(spliced.spliceType).toBe('splice_in');
    expect(spliced.splicedFrom).toBe(ch.channelId);
  });

  it('splice-out: SplicedChannel status active and reduced totalValue', async () => {
    const { q, proposal, acceptance, MINE_OPTS } = await fullSpliceOut(200n);
    const spliced = await finalizeSplice(q, proposal, acceptance, MINE_OPTS);
    expect(spliced.status).toBe('active');
    expect(spliced.totalValue).toBe(800n);
    expect(spliced.currentSequence).toBe(0);
    expect(spliced.spliceType).toBe('splice_out');
  });

  it('new channel has updated balances from proposal', async () => {
    const newBalances = { alice: 900n, bob: 600n };
    const ch = makeChannel();
    const q = await quiesce(ch);
    const aliceLp = makeLeaseProvider(PKD_ALICE);
    const bobLp   = makeLeaseProvider(PKD_BOB);
    const proposal   = await proposeSpliceIn(q, NEW_COIN_ID, 500n, aliceLp, newBalances);
    const acceptance = await acceptSplice(q, proposal, bobLp);
    const spliced = await finalizeSplice(q, proposal, acceptance, {
      ...TEST_MINE_OPTS,
      proposerLeaseProvider: aliceLp.wotsLease,
      acceptorLeaseProvider: bobLp.wotsLease,
    });
    expect(spliced.balances).toEqual(newBalances);
  });

  it('spliceFundingCoinId ends in -0 and becomes new fundingCoinId', async () => {
    const { q, proposal, acceptance, MINE_OPTS } = await fullSpliceIn();
    const spliced = await finalizeSplice(q, proposal, acceptance, MINE_OPTS);
    expect(spliced.spliceFundingCoinId).toMatch(/-0$/);
    expect(spliced.fundingCoinId).toBe(spliced.spliceFundingCoinId);
  });

  it('latestState is null and pendingHTLCs is empty on the new channel', async () => {
    const { q, proposal, acceptance, MINE_OPTS } = await fullSpliceIn();
    const spliced = await finalizeSplice(q, proposal, acceptance, MINE_OPTS);
    expect(spliced.latestState).toBeNull();
    expect(spliced.pendingHTLCs).toHaveLength(0);
  });

  it('stateLog gains a new entry at sequence 0', async () => {
    const { q, proposal, acceptance, MINE_OPTS } = await fullSpliceIn();
    const prevLen = q.stateLog.length;
    const spliced = await finalizeSplice(q, proposal, acceptance, MINE_OPTS);
    expect(spliced.stateLog.length).toBeGreaterThan(prevLen);
    expect(spliced.stateLog[spliced.stateLog.length - 1].sequence).toBe(0);
  });

  it('marks the quiesced channel as status spliced and returns active new channel', async () => {
    const { q, proposal, acceptance, MINE_OPTS } = await fullSpliceIn();
    const spliced = await finalizeSplice(q, proposal, acceptance, MINE_OPTS);
    expect((q as unknown as OmniaChannel).status).toBe('spliced');
    expect(spliced.status).toBe('active');
  });

  it('commits both WOTS lease reservations on success', async () => {
    const { q, proposal, acceptance, aliceLp, bobLp, MINE_OPTS } = await fullSpliceIn();
    const spliced = await finalizeSplice(q, proposal, acceptance, MINE_OPTS);
    expect(aliceLp.wotsLease.commitKeyUse).toHaveBeenCalledWith(
      proposal.proposerReservationId, spliced.spliceFundingTxId,
    );
    expect(bobLp.wotsLease.commitKeyUse).toHaveBeenCalledWith(
      acceptance.acceptorReservationId, spliced.spliceFundingTxId,
    );
    expect(aliceLp.wotsLease.burnReservation).not.toHaveBeenCalled();
    expect(bobLp.wotsLease.burnReservation).not.toHaveBeenCalled();
  });

  it('burns both WOTS lease reservations when broadcast fails', async () => {
    const { q, proposal, acceptance, aliceLp, bobLp, MINE_OPTS } = await fullSpliceIn();
    const rejectBroadcast = jest.fn().mockResolvedValue({ success: false });
    await expect(
      finalizeSplice(q, proposal, acceptance, { ...MINE_OPTS, broadcast: rejectBroadcast }),
    ).rejects.toThrow('broadcast rejected');
    expect(aliceLp.wotsLease.burnReservation).toHaveBeenCalledWith(
      proposal.proposerReservationId, 'finalize-failed',
    );
    expect(bobLp.wotsLease.burnReservation).toHaveBeenCalledWith(
      acceptance.acceptorReservationId, 'finalize-failed',
    );
    expect(aliceLp.wotsLease.commitKeyUse).not.toHaveBeenCalled();
    expect(bobLp.wotsLease.commitKeyUse).not.toHaveBeenCalled();
  });

  it('calls broadcast when provided and uses returned txpowid', async () => {
    const { q, proposal, acceptance, MINE_OPTS } = await fullSpliceIn();
    const mockTxId = '0x' + '44'.repeat(32);
    const broadcastFn = jest.fn().mockResolvedValue({ txpowid: mockTxId });
    const spliced = await finalizeSplice(q, proposal, acceptance, { ...MINE_OPTS, broadcast: broadcastFn });
    expect(broadcastFn).toHaveBeenCalledTimes(1);
    expect(spliced.spliceFundingTxId).toBe(mockTxId);
    expect(spliced.spliceFundingCoinId).toBe(`${mockTxId}-0`);
  });

  it('throws SpliceChannelStatusError if channel is not quiesced', async () => {
    const { ch, proposal, acceptance, MINE_OPTS } = await fullSpliceIn();
    await expect(finalizeSplice(ch, proposal, acceptance, MINE_OPTS))
      .rejects.toThrow(SpliceChannelStatusError);
  });

  it('throws SpliceSignatureMismatchError if proposer signature fails verification', async () => {
    const { q, proposal, acceptance, MINE_OPTS } = await fullSpliceIn();
    const wrongSig = sha3_256(new Uint8Array([0xff, 0xfe]));
    await expect(finalizeSplice(q, { ...proposal, proposerSignature: wrongSig }, acceptance, MINE_OPTS))
      .rejects.toThrow(SpliceSignatureMismatchError);
  });

  it('throws SpliceSignatureMismatchError if acceptor signature fails verification', async () => {
    const { q, proposal, acceptance, MINE_OPTS } = await fullSpliceIn();
    const wrongSig = sha3_256(new Uint8Array([0xfe, 0xfd]));
    await expect(finalizeSplice(q, proposal, { ...acceptance, acceptorSignature: wrongSig }, MINE_OPTS))
      .rejects.toThrow(SpliceSignatureMismatchError);
  });

  it('throws SpliceSignatureMismatchError if spliceIds differ', async () => {
    const { q, proposal, acceptance, MINE_OPTS } = await fullSpliceIn();
    await expect(finalizeSplice(q, proposal, { ...acceptance, spliceId: '0xdeadbeef' }, MINE_OPTS))
      .rejects.toThrow(SpliceSignatureMismatchError);
  });

  it('throws if proposal channelId does not match channel', async () => {
    const { proposal, acceptance, MINE_OPTS } = await fullSpliceIn();
    const otherQ: QuiescedChannel = { ...makeChannel({ channelId: '0xdeadbeef' }), status: 'quiesced', quiesceSignedState: {} };
    await expect(finalizeSplice(otherQ, proposal, acceptance, MINE_OPTS))
      .rejects.toThrow('does not match channel');
  });

  it('throws SpliceMissingPartyError if proposer is not in channel parties', async () => {
    const { proposal, acceptance, MINE_OPTS } = await fullSpliceIn();
    const strangerQ: QuiescedChannel = {
      ...makeChannel({
        channelId: proposal.channelId,
        parties: [
          { partyId: 's1', publicKeyDigest: '0x' + '55'.repeat(32), addressIndex: 0 },
          { partyId: 's2', publicKeyDigest: '0x' + '66'.repeat(32), addressIndex: 1 },
        ],
      }),
      status: 'quiesced',
      quiesceSignedState: {},
    };
    await expect(finalizeSplice(strangerQ, proposal, acceptance, MINE_OPTS))
      .rejects.toThrow(SpliceMissingPartyError);
  });

  it('throws SpliceSignatureMismatchError if proposer signature is empty', async () => {
    const { q, proposal, acceptance, MINE_OPTS } = await fullSpliceIn();
    await expect(finalizeSplice(q, { ...proposal, proposerSignature: new Uint8Array(0) }, acceptance, MINE_OPTS))
      .rejects.toThrow(SpliceSignatureMismatchError);
  });

  it('throws SpliceSignatureMismatchError if acceptor signature is empty', async () => {
    const { q, proposal, acceptance, MINE_OPTS } = await fullSpliceIn();
    await expect(finalizeSplice(q, proposal, { ...acceptance, acceptorSignature: new Uint8Array(0) }, MINE_OPTS))
      .rejects.toThrow(SpliceSignatureMismatchError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full lifecycle: quiesce → propose → accept → finalize
// ─────────────────────────────────────────────────────────────────────────────

describe('Full splice lifecycle', () => {
  beforeEach(() => { _resetChannelWatermarks(); });

  it('splice-in: 1000 → 1500 Minima; quiesced channel marked spliced', async () => {
    const ch = makeChannel();
    const aliceLp = makeLeaseProvider(PKD_ALICE);
    const bobLp   = makeLeaseProvider(PKD_BOB);
    const q = await quiesceChannel(ch, aliceLp);

    const proposal   = await proposeSpliceIn(q, NEW_COIN_ID, 500n, aliceLp, { alice: 900n, bob: 600n });
    const acceptance = await acceptSplice(q, proposal, bobLp);
    const spliced = await finalizeSplice(q, proposal, acceptance, {
      ...TEST_MINE_OPTS,
      proposerLeaseProvider: aliceLp.wotsLease,
      acceptorLeaseProvider: bobLp.wotsLease,
    });

    expect(spliced.totalValue).toBe(1500n);
    expect(spliced.balances).toEqual({ alice: 900n, bob: 600n });
    expect(spliced.currentSequence).toBe(0);
    expect(spliced.status).toBe('active');
    expect(spliced.splicedFrom).toBe(ch.channelId);
    expect((q as unknown as OmniaChannel).status).toBe('spliced');
    expect(ch.status).toBe('active');
    expect(aliceLp.wotsLease.commitKeyUse).toHaveBeenCalled();
    expect(bobLp.wotsLease.commitKeyUse).toHaveBeenCalled();
  });

  it('splice-out: 1000 → 800 Minima (200 withdrawn)', async () => {
    const ch = makeChannel();
    const aliceLp = makeLeaseProvider(PKD_ALICE);
    const bobLp   = makeLeaseProvider(PKD_BOB);
    const q = await quiesceChannel(ch, aliceLp);

    const proposal   = await proposeSpliceOut(q, 200n, EXTRA_ADDRESS, aliceLp, { alice: 480n, bob: 320n });
    const acceptance = await acceptSplice(q, proposal, bobLp);
    const spliced = await finalizeSplice(q, proposal, acceptance, {
      ...TEST_MINE_OPTS,
      proposerLeaseProvider: aliceLp.wotsLease,
      acceptorLeaseProvider: bobLp.wotsLease,
    });

    expect(spliced.totalValue).toBe(800n);
    expect(spliced.status).toBe('active');
    expect((q as unknown as OmniaChannel).status).toBe('spliced');
  });

  it('quiesce clears resolved HTLCs and provides a signed quiesce state', async () => {
    const ch = makeChannel({
      pendingHTLCs: [{
        htlcId: '0x01', amount: 100n, hashlock: '0x' + 'aa'.repeat(32),
        timeoutBlock: 1000n, direction: 'offered', status: 'fulfilled',
        htlcAddress: '0x' + 'ab'.repeat(32),
        senderPublicKeyDigest: PKD_ALICE, recipientPublicKeyDigest: PKD_BOB,
      }],
    });
    const q = await quiesceChannel(ch, makeLeaseProvider(PKD_ALICE));
    expect(q.status).toBe('quiesced');
    expect(q.pendingHTLCs).toHaveLength(0);
    expect(q.quiesceSignedState.sequence).toBe(ch.currentSequence + 1);
  });

  it('quiesce rejects channel with still-pending HTLC', async () => {
    const ch = makeChannel({
      pendingHTLCs: [{
        htlcId: '0x01', amount: 100n, hashlock: '0x' + 'aa'.repeat(32),
        timeoutBlock: 1000n, direction: 'offered', status: 'pending',
        htlcAddress: '0x' + 'ab'.repeat(32),
        senderPublicKeyDigest: PKD_ALICE, recipientPublicKeyDigest: PKD_BOB,
      }],
    });
    await expect(quiesceChannel(ch, makeLeaseProvider(PKD_ALICE))).rejects.toThrow(PendingHTLCError);
  });

  it('combined splice-out + on-chain payment to third address', async () => {
    const ch = makeChannel();
    const aliceLp = makeLeaseProvider(PKD_ALICE);
    const bobLp   = makeLeaseProvider(PKD_BOB);
    const q = await quiesceChannel(ch, aliceLp);

    const proposal = await proposeSpliceOut(
      q, 200n, EXTRA_ADDRESS, aliceLp,
      { alice: 450n, bob: 300n },
      [{ address: THIRD_PARTY_ADDR, amount: 50n }],
    );
    expect(proposal.params.newTotalValue).toBe(750n);
    expect(proposal.spliceTxDraft.outputs).toHaveLength(3);

    const acceptance = await acceptSplice(q, proposal, bobLp);
    const spliced = await finalizeSplice(q, proposal, acceptance, {
      ...TEST_MINE_OPTS,
      proposerLeaseProvider: aliceLp.wotsLease,
      acceptorLeaseProvider: bobLp.wotsLease,
    });
    expect(spliced.totalValue).toBe(750n);
    expect(spliced.status).toBe('active');
  });

  it('new channel has fresh fundingCoinId distinct from old channel', async () => {
    const ch = makeChannel();
    const aliceLp = makeLeaseProvider(PKD_ALICE);
    const bobLp   = makeLeaseProvider(PKD_BOB);
    const q = await quiesceChannel(ch, aliceLp);
    const proposal   = await proposeSpliceIn(q, NEW_COIN_ID, 500n, aliceLp, { alice: 900n, bob: 600n });
    const acceptance = await acceptSplice(q, proposal, bobLp);
    const spliced = await finalizeSplice(q, proposal, acceptance, {
      ...TEST_MINE_OPTS,
      proposerLeaseProvider: aliceLp.wotsLease,
      acceptorLeaseProvider: bobLp.wotsLease,
    });
    expect(spliced.fundingCoinId).not.toBe(ch.fundingCoinId);
    expect(spliced.fundingCoinId).toBe(spliced.spliceFundingCoinId);
  });

  it('original active channel (ch) is never mutated by quiesce or finalize', async () => {
    const ch = makeChannel();
    const originalStatus = ch.status;
    const originalCoinId = ch.fundingCoinId;
    const aliceLp = makeLeaseProvider(PKD_ALICE);
    const bobLp   = makeLeaseProvider(PKD_BOB);
    const q = await quiesceChannel(ch, aliceLp);
    const proposal   = await proposeSpliceIn(q, NEW_COIN_ID, 500n, aliceLp, { alice: 900n, bob: 600n });
    const acceptance = await acceptSplice(q, proposal, bobLp);
    await finalizeSplice(q, proposal, acceptance, {
      ...TEST_MINE_OPTS,
      proposerLeaseProvider: aliceLp.wotsLease,
      acceptorLeaseProvider: bobLp.wotsLease,
    });
    expect(ch.status).toBe(originalStatus);
    expect(ch.fundingCoinId).toBe(originalCoinId);
  });
});
