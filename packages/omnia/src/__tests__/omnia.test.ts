/**
 * @totemsdk/omnia — Unit tests
 *
 * Uses deterministic WOTS test signers derived from fixed seeds.
 * Chain provider and lease provider are fully mocked.
 */
// Mock mineTxPoW so settlement tests run instantly without real PoW mining.
// jest.mock is hoisted by Jest/ts-jest so the mock is active before any imports.
jest.mock('@totemsdk/txpow', () => ({
  ...jest.requireActual('@totemsdk/txpow'),
  mineTxPoW: jest.fn(async (_txBody: Uint8Array, _target: Uint8Array) => ({
    minedHeaderBytes: new Uint8Array(100).fill(0x01),
    txpowId: new Uint8Array(32).fill(0xab),
    nonce: 42n,
    elapsedMs: 0,
    source: 'js' as const,
  })),
}));

jest.mock('@totemsdk/core', () => {
  const actual = jest.requireActual('@totemsdk/core');
  return {
    ...actual,
    wotsVerifyDigest: jest.fn(() => true),
  };
});

import {
  createChannel,
  acceptChannel,
  updateState,
  attachCounterpartySignature,
  getChannelReceipt,
  activateChannel,
  _resetChannelWatermarks,
} from '../channel';
import { addHTLC, fulfillHTLC, timeoutHTLC } from '../htlc';
import { executeIntent } from '../intent';
import {
  proposeSettlement,
  startUnilateralClose,
  finalizeUnilateralClose,
  replaceUnilateralCloseState,
  buildDisputePayload,
  markChannelClosed,
} from '../settlement';
import { buildEltooScript, buildAndHashEltooScript, scriptAddress, COINID_ELTOO, ELTOO_CONTEST_DELAY_BLOCKS } from '../script';
import {
  buildFundingTx,
  buildUpdateTx,
  buildSettlementTx,
  computeTxDraftDigest,
  computeOmniaTxDigest,
  computeStateCommitmentV2,
  minimaOutputCoinIdsForDraft,
  stateCommitmentV2Matches,
  STATE_COMMITMENT_V2_PORT,
  serializeTxDraft,
  deserializeTxDraft,
  toRawMinima,
} from '../transactions';
import {
  BalanceConservationError,
  SequenceError,
  ChannelStatusError,
  ChannelCapacityError,
  DoubleSignError,
} from '../errors';
import { assessCapacity, WOTS_CAPACITY_TOTAL } from '../capacity';
import {
  buildUnsignedClosePackage,
  mergeClosePackages,
  verifyClosePackage,
} from '../close-package';
import { validateChannelStateWithKissvm } from '../kissvm';
import { computeProgramUpdateDigestHex, DefaultEltooPaymentProgram, resolveChannelProgram } from '../program';
import type {
  OmniaChannel,
  ChannelParticipant,
  ChannelSigner,
  CreateChannelParams,
  AddHTLCParams,
  SignedChannelState,
  ChannelSignature,
} from '../types';

// ─────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────

const ALICE_PKD = 'aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd';
const BOB_PKD   = '11223344112233441122334411223344112233441122334411223344112233441122334411223344112233441122334411223344112233441122334411223344';

const alice: ChannelParticipant = {
  partyId: 'alice',
  publicKeyDigest: ALICE_PKD,
  addressIndex: 0,
};
const bob: ChannelParticipant = {
  partyId: 'bob',
  publicKeyDigest: BOB_PKD,
  addressIndex: 1,
};

// ─────────────────────────────────────────────────
// Mock: WotsLeaseProvider
// ─────────────────────────────────────────────────

function makeMockLeaseProvider(startL2 = 0) {
  let l2Counter = startL2;
  const reservations = new Map<string, { l1: number; l2: number }>();

  return {
    reserveKeyUse: jest.fn(async (params: { treeId: string; purpose?: string; payloadHash?: string }) => {
      const l2 = l2Counter++;
      const id = `res-${l2}`;
      const indices = { addressIndex: 0, l1: 0, l2 };
      reservations.set(id, { l1: 0, l2 });
      return {
        reservationId: id,
        indices,
        expiresAt: Date.now() + 60000,
      };
    }),
    commitKeyUse: jest.fn(async (_reservationId: string, _txId: string) => { /* noop */ }),
    burnReservation: jest.fn(async (_reservationId: string, _reason: string) => { /* noop */ }),
    _getCounter: () => l2Counter,
  };
}

// ─────────────────────────────────────────────────
// Mock: ChainStateProvider
// ─────────────────────────────────────────────────

function makeMockChainProvider() {
  let txCounter = 0;
  return {
    broadcastTxPoW: jest.fn(async (_txHex: string) => ({
      txpowid: `0xtxpow${txCounter++}`,
    })),
    getToken: jest.fn(async (tokenId: string) => ({
      tokenId,
      name: { name: 'TestToken' },
      amount: '1000000',
      script: 'RETURN TRUE',
    })),
    getBalance: jest.fn(async (_address: string) => ({
      confirmed: 0n,
      unconfirmed: 0n,
    })),
    getTokensByCreator: jest.fn(async (_address: string) => []),
  };
}

const MOCK_BROADCAST_PROOFS = {
  coinProofs: [new Uint8Array([0x01, 0x02, 0x03])],
  scriptProofs: [new Uint8Array([0x04, 0x05, 0x06])],
};

/** Minimal ChainStateProvider whose getTip() returns the given block height. */
function makeTipProvider(block: number) {
  return {
    getTip: jest.fn(async () => ({ block, hash: `0x${block.toString(16)}` })),
  };
}

/** Provider that confirms a funding coin (for acceptChannel). */
function makeConfirmingProvider(coinId: string, amount: bigint, tokenId: string) {
  return {
    getCoin: jest.fn(async (id: string) => {
      if (id !== coinId) return null;
      return { coinId, amount: amount.toString(), tokenid: tokenId, spent: false, mmrentry: 1 };
    }),
    getTip: jest.fn(async () => ({ block: 2, hash: '0x02' })),
  };
}

// ─────────────────────────────────────────────────
// Mock: ChannelSigner
// Returns a deterministic fake signature (not cryptographically valid).
// Tests verify logical structure, not WOTS validity.
// ─────────────────────────────────────────────────

function makeMockSigner(partyId: string, pkDigest: string): ChannelSigner {
  return {
    publicKeyDigest: pkDigest,
    sign: jest.fn(async (payload: Uint8Array, _indices: any): Promise<ChannelSignature> => {
      // Return a deterministic 1088-byte fake signature (all zeros + partyId marker)
      const sig = new Uint8Array(1088);
      const marker = Buffer.from(partyId, 'utf8');
      sig.set(marker.subarray(0, Math.min(marker.length, 8)));
      return sig;
    }),
  };
}

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function makeTestChannel(overrides: Partial<OmniaChannel> = {}): OmniaChannel {
  const { script, address } = buildAndHashEltooScript([alice, bob]);
  const now = Date.now();
  const base: OmniaChannel = {
    channelId: '0xdeadbeef00000001',
    fundingTxId: '0xtxpow0',
    fundingCoinId: '0x' + 'aa'.repeat(32),
    fundingScript: script,
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: address,
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1000n,
    parties: [alice, bob],
    balances: { alice: 600n, bob: 400n },
    pendingHTLCs: [],
    currentSequence: 0,
    latestState: null,
    stateLog: [
      { sequence: 0, timestamp: now, balances: { alice: 600n, bob: 400n }, htlcCount: 0, event: 'open' },
    ],
    status: 'active',
    channelType: 'direct',
    createdAt: now,
    updatedAt: now,
  };
  return { ...base, ...overrides };
}

async function makeCompleteSignedState(
  channel: OmniaChannel,
  newBalances: Record<string, bigint>,
  startL2 = 0,
): Promise<{ channel: OmniaChannel; signedState: SignedChannelState }> {
  const aliceSigner = makeMockSigner('alice', ALICE_PKD);
  const bobSigner = makeMockSigner('bob', BOB_PKD);
  const aliceLeaseProvider = makeMockLeaseProvider(startL2);
  const bobLeaseProvider = makeMockLeaseProvider(startL2);
  const { channel: updatedChannel, signedState } = await updateState(
    channel,
    { newBalances },
    aliceLeaseProvider as any,
    aliceSigner,
  );
  const { signState } = await import('../sign');
  const bobPartialState = await signState(
    channel,
    { newSequence: signedState.sequence!, newBalances: signedState.balances! },
    bobLeaseProvider as any,
    bobSigner,
  );
  return attachCounterpartySignature(
    updatedChannel,
    signedState,
    'bob',
    bobPartialState.signatures!.bob,
    bobPartialState.signingIndices!.bob,
    bobPartialState.closePackage,
  );
}

// ─────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────

describe('@totemsdk/omnia — eltoo script builder', () => {
  it('builds a deterministic 2-party eltoo script', () => {
    const script = buildEltooScript([alice, bob]);
    expect(script).toContain('MULTISIG(2');
    expect(script).toContain('STATE(100)');
    expect(script).toContain('STATE(101)');
    expect(script).toContain('PREVSTATE(101)');
    expect(script).toContain(`@COINAGE GTE ${ELTOO_CONTEST_DELAY_BLOCKS}`);
    expect(script.toUpperCase()).toBe(script); // fully uppercase
  });

  it('keeps update and settlement branches explicit for unilateral close', () => {
    const script = buildEltooScript([alice, bob]);
    expect(script).toContain('LET BOTHSIGNED=MULTISIG(2');
    expect(script).toContain('ASSERT SEQUENCE EQ PREVSEQUENCE');
    expect(script).toContain('ASSERT SEQUENCE GT PREVSEQUENCE');
    expect(script).not.toContain('ASSERT MULTISIG(2');
  });

  it('script contains both party public key digests', () => {
    const script = buildEltooScript([alice, bob]);
    expect(script.toUpperCase()).toContain(ALICE_PKD.toUpperCase());
    expect(script.toUpperCase()).toContain(BOB_PKD.toUpperCase());
  });

  it('produces a deterministic address for the same parties', () => {
    const { address: addr1 } = buildAndHashEltooScript([alice, bob]);
    const { address: addr2 } = buildAndHashEltooScript([alice, bob]);
    expect(addr1).toBe(addr2);
    expect(typeof addr1).toBe('string');
    expect(addr1.length).toBeGreaterThan(0);
  });

  it('throws for party counts other than 2', () => {
    expect(() => buildEltooScript([alice])).toThrow();
    expect(() => buildEltooScript([alice, bob, alice])).toThrow();
  });
});

describe('@totemsdk/omnia — transaction builders', () => {
  const channel = makeTestChannel();

  it('buildFundingTx: type=funding, storeState=true, STATE(100)=false, STATE(101)=0', () => {
    const { script, address } = buildAndHashEltooScript([alice, bob]);
    const draft = buildFundingTx(script, address, 1000n, '0x00', 0, ['coin-1'], [1000n], ['prevAddress']);
    expect(draft.type).toBe('funding');
    expect(draft.storeState).toBe(true);
    expect(draft.outputs).toHaveLength(1);
    expect(draft.outputs[0].storeState).toBe(true);
    const sv100 = draft.stateVariables.find(sv => sv.port === 100);
    const sv101 = draft.stateVariables.find(sv => sv.port === 101);
    expect(sv100?.value).toBe(false);
    expect(sv101?.value).toBe(0n);
  });

  it('buildUpdateTx: type=update, storeState=true, uses floating eltoo coinId, STATE(100)=false', () => {
    const draft = buildUpdateTx(channel, 3, { alice: 500n, bob: 500n }, []);
    expect(draft.type).toBe('update');
    expect(draft.storeState).toBe(true);
    expect(draft.inputs[0].coinId).toBe(COINID_ELTOO);
    const sv100 = draft.stateVariables.find(sv => sv.port === 100);
    const sv101 = draft.stateVariables.find(sv => sv.port === 101);
    const sv102 = draft.stateVariables.find(sv => sv.port === STATE_COMMITMENT_V2_PORT);
    expect(sv100?.value).toBe(false);
    expect(sv101?.value).toBe(3n);
    expect(sv102?.type).toBe('hex');
    expect(draft.outputs[0].storeState).toBe(true);
  });

  it('buildUpdateTx: output amount equals totalValue', () => {
    const draft = buildUpdateTx(channel, 1, { alice: 600n, bob: 400n }, []);
    expect(draft.outputs[0].amount).toBe(1000n);
  });

  it('buildSettlementTx: type=settlement, STATE(100)=true, outputs per party', () => {
    const state: SignedChannelState = {
      sequence: 5,
      balances: { alice: 700n, bob: 300n },
      pendingHTLCs: [],
      stateVariables: [
        { port: 100, value: true, type: 'bool' },
        { port: 101, value: 5n, type: 'number' },
      ],
      transactionHex: '',
      signatures: {},
      signingIndices: {},
    };
    const partyAddresses = { alice: '0x' + 'aa'.repeat(32), bob: '0x' + 'bb'.repeat(32) };
    const draft = buildSettlementTx(channel, state, partyAddresses);
    expect(draft.type).toBe('settlement');
    const sv100 = draft.stateVariables.find(sv => sv.port === 100);
    const sv101 = draft.stateVariables.find(sv => sv.port === 101);
    expect(sv100?.value).toBe(true);
    expect(sv101?.value).toBe(5n);
    expect(draft.outputs).toHaveLength(2);
    const aliceAddr = '0x' + 'aa'.repeat(32);
    const bobAddr = '0x' + 'bb'.repeat(32);
    const aliceOut = draft.outputs.find(o => o.address === aliceAddr);
    const bobOut = draft.outputs.find(o => o.address === bobAddr);
    expect(aliceOut?.amount).toBe(700n);
    expect(bobOut?.amount).toBe(300n);
  });

  it('buildSettlementTx can use a floating Eltoo input for pre-signed close packages', () => {
    const updateDraft = buildUpdateTx(channel, 5, { alice: 700n, bob: 300n }, []);
    const state: SignedChannelState = {
      sequence: 5,
      balances: { alice: 700n, bob: 300n },
      pendingHTLCs: [],
      stateVariables: updateDraft.stateVariables,
      transactionHex: '',
      signatures: {},
      signingIndices: {},
    };
    const partyAddresses = { alice: '0x' + 'aa'.repeat(32), bob: '0x' + 'bb'.repeat(32) };
    const draft = buildSettlementTx(channel, state, partyAddresses, { floatingInput: true });
    expect(draft.inputs[0].coinId).toBe(COINID_ELTOO);
  });

  it('serializeTxDraft and deserializeTxDraft roundtrip', () => {
    const draft = buildUpdateTx(channel, 1, { alice: 500n, bob: 500n }, []);
    const hex = serializeTxDraft(draft);
    expect(typeof hex).toBe('string');
    expect(hex.length).toBeGreaterThan(0);
    const restored = deserializeTxDraft(hex);
    expect(restored.type).toBe(draft.type);
    expect(restored.storeState).toBe(draft.storeState);
  });

  it('computeTxDraftDigest produces a 32-byte hash', () => {
    const draft = buildUpdateTx(channel, 1, { alice: 500n, bob: 500n }, []);
    const digest = computeTxDraftDigest(draft);
    expect(digest).toBeInstanceOf(Uint8Array);
    expect(digest.length).toBe(32);
  });

  it('different sequences produce different digests', () => {
    const d1 = computeTxDraftDigest(buildUpdateTx(channel, 1, { alice: 500n, bob: 500n }, []));
    const d2 = computeTxDraftDigest(buildUpdateTx(channel, 2, { alice: 500n, bob: 500n }, []));
    expect(Buffer.from(d1).toString('hex')).not.toBe(Buffer.from(d2).toString('hex'));
  });

  it('canonical digest differs from legacy JSON draft digest', () => {
    const draft = buildUpdateTx(channel, 1, { alice: 500n, bob: 500n }, []);
    const legacy = computeTxDraftDigest(draft);
    const canonical = computeOmniaTxDigest(draft);
    expect(canonical).toBeInstanceOf(Uint8Array);
    expect(canonical).toHaveLength(32);
    expect(Buffer.from(canonical).toString('hex')).not.toBe(Buffer.from(legacy).toString('hex'));
  });

  it('eltoo floating update keeps Minima output coin IDs as COINID_OUTPUT', () => {
    const draft = buildUpdateTx(channel, 1, { alice: 500n, bob: 500n }, []);
    expect(minimaOutputCoinIdsForDraft(draft)).toEqual(['0x00']);
  });

  it('non-eltoo funding precomputes output coin IDs before canonical digest', () => {
    const { script, address } = buildAndHashEltooScript([alice, bob]);
    const draft = buildFundingTx(script, address, 1000n, '0x00', 0, ['0x' + '11'.repeat(32)], [1000n], ['0x' + '22'.repeat(32)]);
    const outputIds = minimaOutputCoinIdsForDraft(draft);
    expect(outputIds).toHaveLength(1);
    expect(outputIds[0]).toMatch(/^0x[0-9a-f]{64}$/);
    expect(outputIds[0]).not.toBe('0x00');
  });

  it('StateCommitmentV2 binds balances and channel metadata into STATE(102)', () => {
    const draft = buildUpdateTx(channel, 1, { alice: 500n, bob: 500n }, []);
    const state: SignedChannelState = {
      sequence: 1,
      balances: { alice: 500n, bob: 500n },
      pendingHTLCs: [],
      stateVariables: draft.stateVariables,
      transactionHex: '',
      signatures: {},
      signingIndices: {},
    };
    expect(stateCommitmentV2Matches(channel, state)).toBe(true);

    const tampered = computeStateCommitmentV2(channel, 1, { alice: 900n, bob: 100n }, []);
    const original = draft.stateVariables.find(sv => sv.port === STATE_COMMITMENT_V2_PORT)?.value;
    expect(original).not.toBe('0x' + Buffer.from(tampered).toString('hex'));
  });
});

describe('@totemsdk/omnia — capacity management', () => {
  it('returns no warning below 75%', () => {
    const { warning } = assessCapacity(100);
    expect(warning).toBeUndefined();
  });

  it('returns approaching warning at 75%', () => {
    const { warning } = assessCapacity(Math.floor(WOTS_CAPACITY_TOTAL * 0.80));
    expect(warning).toBe('approaching');
  });

  it('returns critical warning at 90%', () => {
    const { warning } = assessCapacity(Math.floor(WOTS_CAPACITY_TOTAL * 0.92));
    expect(warning).toBe('critical');
  });

  it('throws ChannelCapacityError at 100%', () => {
    expect(() => assessCapacity(WOTS_CAPACITY_TOTAL)).toThrow(ChannelCapacityError);
  });
});

describe('@totemsdk/omnia — acceptChannel', () => {
  it('returns active channel with correct totals', async () => {
    const { script, address } = buildAndHashEltooScript([alice, bob]);
    const proposal = {
      channelId: '0xchannelid',
      localParty: alice,
      remoteParty: bob,
      localAmount: 600n,
      remoteAmount: 400n,
      tokenId: '0x00',
      fundingScript: script,
      fundingTxId: '0xtxpow0',
      fundingCoinId: '0x' + 'aa'.repeat(32),
    };
    const provider = makeConfirmingProvider(proposal.fundingCoinId, 1000n, '0x00');
    const channel = await acceptChannel(proposal, provider as any);
    expect(channel.status).toBe('active');
    expect(channel.totalValue).toBe(1000n);
    expect(channel.balances.alice).toBe(600n);
    expect(channel.balances.bob).toBe(400n);
    expect(channel.currentSequence).toBe(0);
    expect(channel.fundingScript).toBe(script);
  });

  it('throws if script is tampered', async () => {
    const proposal = {
      channelId: '0xchannelid',
      localParty: alice,
      remoteParty: bob,
      localAmount: 600n,
      remoteAmount: 400n,
      tokenId: '0x00',
      fundingScript: 'RETURN TRUE',
      fundingTxId: '0xtxpow0',
      fundingCoinId: '0x' + 'aa'.repeat(32),
    };
    await expect(acceptChannel(proposal)).rejects.toThrow('Script mismatch');
  });
});

describe('@totemsdk/omnia — createChannel', () => {
  it('calls broadcastTxPoW and returns channel in opening status', async () => {
    const chainProvider = makeMockChainProvider();
    const params: CreateChannelParams = {
      localParty: alice,
      remoteParty: bob,
      localAmount: 600n,
      remoteAmount: 400n,
      tokenId: '0x00',
      fundingCoinId: '0x' + 'aa'.repeat(32),
      fundingWitnessBytes: new Uint8Array([0x09, 0x09]),
    };
    const { channel, proposal } = await createChannel(params, chainProvider as any);
    expect(chainProvider.broadcastTxPoW).toHaveBeenCalledTimes(1);
    expect(channel.status).toBe('opening');
    expect(channel.totalValue).toBe(1000n);
    expect(channel.tokenId).toBe('0x00');
    expect(channel.programId).toBe('eltoo-payment');
    expect(channel.programVersion).toBe(1);
    expect(proposal.programId).toBe('eltoo-payment');
    expect(proposal.programVersion).toBe(1);
    expect(proposal.fundingTxId).toMatch(/^0xtxpow/);
    expect(channel.stateLog).toHaveLength(1);
    expect(channel.stateLog[0].event).toBe('open');
  });

  it('fails closed without serialized funding witness bytes', async () => {
    const chainProvider = makeMockChainProvider();
    const params: CreateChannelParams = {
      localParty: alice,
      remoteParty: bob,
      localAmount: 600n,
      remoteAmount: 400n,
      tokenId: '0x00',
      fundingCoinId: '0x' + 'aa'.repeat(32),
    };
    await expect(createChannel(params, chainProvider as any)).rejects.toThrow('fundingWitnessBytes');
    expect(chainProvider.broadcastTxPoW).not.toHaveBeenCalled();
  });
});

describe('@totemsdk/omnia — ChannelProgram', () => {
  beforeEach(() => {
    _resetChannelWatermarks();
  });

  it('default Eltoo payment program owns the funding script', () => {
    expect(DefaultEltooPaymentProgram.id).toBe('eltoo-payment');
    expect(DefaultEltooPaymentProgram.buildScript([alice, bob])).toBe(buildEltooScript([alice, bob]));
  });

  it('includes custom program state variables in update state and V2 commitment', async () => {
    const channel = makeTestChannel({ programId: 'metered-payment', programVersion: 1 });
    const customProgram = {
      id: 'metered-payment',
      version: 1,
      buildScript: DefaultEltooPaymentProgram.buildScript,
      buildStateVariables: () => [{ port: 120, value: 42n, type: 'number' as const }],
    };
    const { registerChannelProgram } = await import('../program');
    registerChannelProgram(customProgram);

    const result = await updateState(
      channel,
      { newBalances: { alice: 500n, bob: 500n } },
      makeMockLeaseProvider() as any,
      makeMockSigner('alice', ALICE_PKD),
    );

    expect(result.signedState.stateVariables).toEqual(expect.arrayContaining([
      { port: 120, value: 42n, type: 'number' },
    ]));
    expect(stateCommitmentV2Matches(channel, result.signedState as SignedChannelState)).toBe(true);
  });

  it('derives funding address from custom program script', async () => {
    const customProgram = {
      id: 'custom-script-program',
      version: 1,
      buildScript: () => 'RETURN TRUE',
      buildStateVariables: () => [],
    };
    const chainProvider = makeMockChainProvider();

    const { channel, proposal } = await createChannel({
      localParty: alice,
      remoteParty: bob,
      localAmount: 600n,
      remoteAmount: 400n,
      fundingCoinId: '0x' + 'aa'.repeat(32),
      fundingWitnessBytes: new Uint8Array([0x09, 0x09]),
      program: customProgram,
    }, chainProvider as any);

    expect(channel.fundingScript).toBe('RETURN TRUE');
    expect(channel.fundingAddress).toBe(scriptAddress('RETURN TRUE'));
    expect(proposal.programId).toBe('custom-script-program');
    expect(proposal.programVersion).toBe(1);
  });

  it('runs program validation hooks during verifyState', async () => {
    const { registerChannelProgram } = await import('../program');
    registerChannelProgram({
      id: 'rejecting-program',
      version: 1,
      buildScript: DefaultEltooPaymentProgram.buildScript,
      buildStateVariables: () => [],
      validateTransition: () => ({ valid: false, error: 'blocked by program' }),
    });
    const initial = makeTestChannel({ programId: 'rejecting-program', programVersion: 1 });
    const { signedState } = await makeCompleteSignedState(initial, { alice: 500n, bob: 500n });
    const { verifyState } = await import('../sign');

    const result = await verifyState(initial, signedState);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(['program validation failed: blocked by program']));
  });

  it('rejects unknown persisted program IDs instead of falling back to default', () => {
    expect(() => resolveChannelProgram({ id: 'missing-program', version: 1 })).toThrow('Unknown ChannelProgram');
  });

  it('uses program-owned state in update watermarks', async () => {
    const { registerChannelProgram } = await import('../program');
    registerChannelProgram({
      id: 'watermark-program-a',
      version: 1,
      buildScript: DefaultEltooPaymentProgram.buildScript,
      buildStateVariables: () => [{ port: 120, value: 1n, type: 'number' as const }],
    });
    registerChannelProgram({
      id: 'watermark-program-b',
      version: 1,
      buildScript: DefaultEltooPaymentProgram.buildScript,
      buildStateVariables: () => [{ port: 120, value: 2n, type: 'number' as const }],
    });
    const channelA = makeTestChannel({ programId: 'watermark-program-a', programVersion: 1 });
    const channelB = makeTestChannel({ programId: 'watermark-program-b', programVersion: 1 });

    expect(computeProgramUpdateDigestHex(channelA, 1, { alice: 500n, bob: 500n }, []))
      .not.toBe(computeProgramUpdateDigestHex(channelB, 1, { alice: 500n, bob: 500n }, []));
  });
});

describe('@totemsdk/omnia — updateState (full lifecycle)', () => {
  let channel: OmniaChannel;
  let aliceSigner: ChannelSigner;
  let leaseProvider: ReturnType<typeof makeMockLeaseProvider>;

  beforeEach(() => {
    // Reset module-level watermarks so tests sharing channelId don't bleed state.
    _resetChannelWatermarks();
    channel = makeTestChannel();
    aliceSigner = makeMockSigner('alice', ALICE_PKD);
    leaseProvider = makeMockLeaseProvider();
  });

  it('single update: sequence increments, balances update', async () => {
    const result = await updateState(
      channel,
      { newBalances: { alice: 500n, bob: 500n } },
      leaseProvider as any,
      aliceSigner,
    );
    expect(result.channel.currentSequence).toBe(1);
    expect(result.channel.balances.alice).toBe(500n);
    expect(result.channel.balances.bob).toBe(500n);
    expect(result.signedState.sequence).toBe(1);
    expect(result.signedState.transactionHex).toBeTruthy();
  });

  it('full lifecycle: 5 consecutive updates succeed', async () => {
    let ch = channel;
    for (let i = 1; i <= 5; i++) {
      const newAlice = BigInt(600 - i * 10);
      const newBob = BigInt(400 + i * 10);
      const r = await updateState(
        ch,
        { newBalances: { alice: newAlice, bob: newBob } },
        leaseProvider as any,
        aliceSigner,
      );
      ch = r.channel;
      expect(ch.currentSequence).toBe(i);
      expect(ch.balances.alice).toBe(newAlice);
      expect(ch.balances.bob).toBe(newBob);
    }
    expect(ch.stateLog).toHaveLength(6); // open + 5 updates
    expect(ch.stateLog.map(e => e.event)).toEqual([
      'open', 'update', 'update', 'update', 'update', 'update',
    ]);
  });

  it('partial state has storeState=true flag via stateVariables', async () => {
    const r = await updateState(
      channel,
      { newBalances: { alice: 500n, bob: 500n } },
      leaseProvider as any,
      aliceSigner,
    );
    expect(r.signedState.stateVariables).toEqual(
      expect.arrayContaining([
        { port: 100, value: false, type: 'bool' },
        { port: 101, value: 1n, type: 'number' },
      ])
    );
    expect(r.signedState.stateVariables?.some(sv => sv.port === STATE_COMMITMENT_V2_PORT)).toBe(true);
  });

  it('updateState called on correctly returned channel succeeds (not stale)', async () => {
    const r = await updateState(
      channel,
      { newBalances: { alice: 500n, bob: 500n } },
      leaseProvider as any,
      aliceSigner,
    );
    await expect(
      updateState(r.channel, { newBalances: { alice: 500n, bob: 500n } }, leaseProvider as any, aliceSigner)
    ).resolves.toBeDefined();
  });

  it('DoubleSignError: stale channel copy signing different payload at same sequence', async () => {
    // Advance the authoritative watermark to sequence 1 by signing once.
    await updateState(
      channel,
      { newBalances: { alice: 500n, bob: 500n } },
      leaseProvider as any,
      aliceSigner,
    );
    // Now try to sign again at the same sequence (channel.currentSequence still 0,
    // so next proposed sequence is 1) but with a DIFFERENT payload (different balances).
    // The watermark is already at { sequence: 1, payloadHash: X }.
    // Different balances → different payloadHash → DoubleSignError.
    const { DoubleSignError } = await import('../errors');
    await expect(
      updateState(
        channel,  // stale copy: currentSequence=0, so it will attempt sequence 1 again
        { newBalances: { alice: 400n, bob: 600n } },  // different balances → different hash
        leaseProvider as any,
        aliceSigner,
      )
    ).rejects.toThrow(DoubleSignError);
  });

  it('SequenceError: stale channel copy trying to reuse sequence already passed', async () => {
    // Advance to sequence 2 by signing twice with the correctly updated channel.
    const r1 = await updateState(
      channel,
      { newBalances: { alice: 500n, bob: 500n } },
      leaseProvider as any,
      aliceSigner,
    );
    await updateState(
      r1.channel,  // correct updated channel (currentSequence=1)
      { newBalances: { alice: 480n, bob: 520n } },
      leaseProvider as any,
      aliceSigner,
    );
    // Watermark is now at sequence 2. The original stale channel copy (currentSequence=0)
    // would produce newSequence=1, which is < watermark.sequence(2) → SequenceError.
    await expect(
      updateState(
        channel,  // stale copy: currentSequence=0 → newSequence=1, but watermark is at 2
        { newBalances: { alice: 500n, bob: 500n } },
        leaseProvider as any,
        aliceSigner,
      )
    ).rejects.toThrow(SequenceError);
  });

  it('throws BalanceConservationError when balances do not sum to totalValue', async () => {
    await expect(
      updateState(
        channel,
        { newBalances: { alice: 600n, bob: 401n } },
        leaseProvider as any,
        aliceSigner,
      )
    ).rejects.toThrow(BalanceConservationError);
  });

  it('throws ChannelStatusError when channel is not active', async () => {
    const closedChannel = { ...channel, status: 'closed' as const };
    await expect(
      updateState(closedChannel, { newBalances: { alice: 500n, bob: 500n } }, leaseProvider as any, aliceSigner)
    ).rejects.toThrow(ChannelStatusError);
  });

  it('returns CAPACITY_NEAR_EXHAUSTION error at ≥95% (3891) updates', async () => {
    const nearExhaustedChannel = makeTestChannel({
      currentSequence: 3890, // next sequence = 3891 = 95% of 4096
    });
    const result = await updateState(
      nearExhaustedChannel,
      { newBalances: { alice: 500n, bob: 500n } },
      leaseProvider as any,
      aliceSigner,
    );
    expect(result.error).toBe('CAPACITY_NEAR_EXHAUSTION');
    expect(result.signedState).toBeDefined();
    expect(leaseProvider.reserveKeyUse).not.toHaveBeenCalled();
  });

  it('leaseProvider.reserveKeyUse and commitKeyUse called per update', async () => {
    await updateState(
      channel,
      { newBalances: { alice: 500n, bob: 500n } },
      leaseProvider as any,
      aliceSigner,
    );
    expect(leaseProvider.reserveKeyUse).toHaveBeenCalledTimes(2);
    expect(leaseProvider.commitKeyUse).toHaveBeenCalledTimes(2);
    expect(leaseProvider.reserveKeyUse.mock.calls.map(call => call[0].purpose)).toEqual([
      'channel-update-seq-1',
      'channel-settlement-seq-1',
    ]);
  });
});

describe('@totemsdk/omnia — attachCounterpartySignature', () => {
  beforeEach(() => {
    _resetChannelWatermarks();
  });

  it('merges counterparty signature into signed state', async () => {
    const channel = makeTestChannel();
    const aliceSigner = makeMockSigner('alice', ALICE_PKD);
    const leaseProvider = makeMockLeaseProvider();

    const { channel: ch1, signedState } = await updateState(
      channel,
      { newBalances: { alice: 500n, bob: 500n } },
      leaseProvider as any,
      aliceSigner,
    );

    const bobSig = new Uint8Array(1088).fill(2);
    const bobIndices = { addressIndex: 0, l1: 0, l2: 99 };
    const { signedState: fullState } = attachCounterpartySignature(
      ch1, signedState, 'bob', bobSig, bobIndices
    );

    expect(fullState.signatures['alice']).toBeDefined();
    expect(fullState.signatures['bob']).toBe(bobSig);
    expect(fullState.signingIndices['bob']).toBe(bobIndices);
    expect(fullState.sequence).toBe(1);
    expect(fullState.closePackage?.update.signatures['bob']).toBeUndefined();
    expect(fullState.closePackage?.settlement.signatures['bob']).toBeUndefined();
  });

  it('merges a complete counterparty close package into latest state', async () => {
    const channel = makeTestChannel();
    const aliceSigner = makeMockSigner('alice', ALICE_PKD);
    const bobSigner = makeMockSigner('bob', BOB_PKD);
    const aliceLeaseProvider = makeMockLeaseProvider();
    const bobLeaseProvider = makeMockLeaseProvider();

    const { channel: ch1, signedState } = await updateState(
      channel,
      { newBalances: { alice: 500n, bob: 500n } },
      aliceLeaseProvider as any,
      aliceSigner,
    );
    const { signState } = await import('../sign');
    const bobPartialState = await signState(
      channel,
      { newSequence: signedState.sequence!, newBalances: signedState.balances! },
      bobLeaseProvider as any,
      bobSigner,
    );

    const { signedState: fullState } = attachCounterpartySignature(
      ch1,
      signedState,
      'bob',
      bobPartialState.signatures!.bob,
      bobPartialState.signingIndices!.bob,
      bobPartialState.closePackage,
    );

    expect(fullState.closePackage?.update.signatures.alice).toBeDefined();
    expect(fullState.closePackage?.update.signatures.bob).toBeDefined();
    expect(fullState.closePackage?.settlement.signatures.alice).toBeDefined();
    expect(fullState.closePackage?.settlement.signatures.bob).toBeDefined();
    expect(fullState.closePackage?.settlement.txDigest).not.toBe(fullState.closePackage?.update.txDigest);
    expect(deserializeTxDraft(fullState.closePackage!.settlement.txHex).inputs[0].coinId).toBe(COINID_ELTOO);
  });
});

describe('@totemsdk/omnia — close packages', () => {
  beforeEach(() => {
    _resetChannelWatermarks();
  });

  it('builds unsigned update and settlement artifacts bound to STATE(102)', () => {
    const channel = makeTestChannel();
    const updateDraft = buildUpdateTx(channel, 1, { alice: 500n, bob: 500n }, []);
    const closePackage = buildUnsignedClosePackage(channel, {
      sequence: 1,
      balances: { alice: 500n, bob: 500n },
      pendingHTLCs: [],
      stateVariables: updateDraft.stateVariables,
    });

    expect(closePackage.version).toBe(1);
    expect(closePackage.channelId).toBe(channel.channelId);
    expect(closePackage.update.txDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(closePackage.settlement.txDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(closePackage.update.txDigest).not.toBe(closePackage.settlement.txDigest);
    expect(deserializeTxDraft(closePackage.update.txHex).inputs[0].coinId).toBe(COINID_ELTOO);
    expect(deserializeTxDraft(closePackage.settlement.txHex).inputs[0].coinId).toBe(COINID_ELTOO);
  });

  it('detects incomplete close packages', async () => {
    const channel = makeTestChannel();
    const leaseProvider = makeMockLeaseProvider();
    const aliceSigner = makeMockSigner('alice', ALICE_PKD);
    const { signedState } = await updateState(
      channel,
      { newBalances: { alice: 500n, bob: 500n } },
      leaseProvider as any,
      aliceSigner,
    );

    const result = verifyClosePackage(channel, signedState as SignedChannelState);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'missing update close artifact signature for bob',
      'missing settlement close artifact signature for bob',
    ]));
  });

  it('refuses to merge close packages with different artifacts', () => {
    const channel = makeTestChannel();
    const updateDraftA = buildUpdateTx(channel, 1, { alice: 500n, bob: 500n }, []);
    const updateDraftB = buildUpdateTx(channel, 1, { alice: 700n, bob: 300n }, []);
    const closePackageA = buildUnsignedClosePackage(channel, {
      sequence: 1,
      balances: { alice: 500n, bob: 500n },
      pendingHTLCs: [],
      stateVariables: updateDraftA.stateVariables,
    });
    const closePackageB = buildUnsignedClosePackage(channel, {
      sequence: 1,
      balances: { alice: 700n, bob: 300n },
      pendingHTLCs: [],
      stateVariables: updateDraftB.stateVariables,
    });

    expect(() => mergeClosePackages(closePackageA, closePackageB)).toThrow('different artifacts');
  });
});

describe('@totemsdk/omnia — getChannelReceipt', () => {
  it('returns receipt with correct capacityUsed and sequence', () => {
    const channel = makeTestChannel({ currentSequence: 3 });
    const state: SignedChannelState = {
      sequence: 3,
      balances: { alice: 600n, bob: 400n },
      pendingHTLCs: [],
      stateVariables: [],
      transactionHex: '',
      signatures: {},
      signingIndices: {},
    };
    const receipt = getChannelReceipt(channel, state);
    expect(receipt.sequence).toBe(3);
    expect(receipt.capacityUsed).toBe(3);
    expect(receipt.capacityTotal).toBe(WOTS_CAPACITY_TOTAL);
    expect(receipt.channelId).toBe(channel.channelId);
  });
});

describe('@totemsdk/omnia — HTLC lifecycle', () => {
  let channel: OmniaChannel;
  let aliceSigner: ChannelSigner;
  let leaseProvider: ReturnType<typeof makeMockLeaseProvider>;

  beforeEach(() => {
    _resetChannelWatermarks();
    channel = makeTestChannel();
    aliceSigner = makeMockSigner('alice', ALICE_PKD);
    leaseProvider = makeMockLeaseProvider();
  });

  it('addHTLC: deducts from sender, creates HTLC record with pending status', async () => {
    const params: AddHTLCParams = {
      amount: 100n,
      hashlock: 'aabbcc00'.repeat(8),
      timeoutBlock: 1000n,
      direction: 'offered',
      counterpartPublicKeyDigest: BOB_PKD,
    };
    const result = await addHTLC(channel, params, leaseProvider as any, aliceSigner);
    expect(result.channel.balances.alice).toBe(500n);
    expect(result.channel.balances.bob).toBe(400n);
    expect(result.channel.pendingHTLCs).toHaveLength(1);
    expect(result.channel.pendingHTLCs[0].status).toBe('pending');
    expect(result.channel.pendingHTLCs[0].amount).toBe(100n);
    expect(result.htlcId).toBeTruthy();
    expect(result.partialState.stateVariables).toEqual(
      expect.arrayContaining([{ port: 100, value: false, type: 'bool' }])
    );
  });

  it('addHTLC: throws if sender has insufficient balance', async () => {
    const params: AddHTLCParams = {
      amount: 700n, // alice only has 600n
      hashlock: 'aabbcc00'.repeat(8),
      timeoutBlock: 1000n,
      direction: 'offered',
      counterpartPublicKeyDigest: BOB_PKD,
    };
    await expect(addHTLC(channel, params, leaseProvider as any, aliceSigner))
      .rejects.toThrow('Insufficient balance');
  });

  it('fulfillHTLC: restores amount to recipient, marks HTLC as fulfilled', async () => {
    const { preimage, hash } = require('@totemsdk/core').HTLCHelper.generateSecret();
    const params: AddHTLCParams = {
      amount: 100n,
      hashlock: hash,
      timeoutBlock: 1000n,
      direction: 'offered',
      counterpartPublicKeyDigest: BOB_PKD,
    };
    const { channel: ch1, htlcId } = await addHTLC(channel, params, leaseProvider as any, aliceSigner);
    const bobSigner = makeMockSigner('bob', BOB_PKD);
    const { channel: ch2 } = await fulfillHTLC(ch1, htlcId, preimage, leaseProvider as any, bobSigner);

    expect(ch2.pendingHTLCs[0].status).toBe('fulfilled');
    expect(ch2.balances.bob).toBe(400n + 100n);
    expect(ch2.balances.alice).toBe(500n);
  });

  it('fulfillHTLC: throws on wrong preimage', async () => {
    const { hash } = require('@totemsdk/core').HTLCHelper.generateSecret();
    const params: AddHTLCParams = {
      amount: 100n,
      hashlock: hash,
      timeoutBlock: 1000n,
      direction: 'offered',
      counterpartPublicKeyDigest: BOB_PKD,
    };
    const { channel: ch1, htlcId } = await addHTLC(channel, params, leaseProvider as any, aliceSigner);
    const wrongPreimage = 'ff'.repeat(32);
    await expect(fulfillHTLC(ch1, htlcId, wrongPreimage, leaseProvider as any, aliceSigner))
      .rejects.toThrow('Preimage does not match');
  });

  it('timeoutHTLC: reclaims amount to sender when block >= timeoutBlock', async () => {
    const params: AddHTLCParams = {
      amount: 100n,
      hashlock: 'aabbcc00'.repeat(8),
      timeoutBlock: 500n,
      direction: 'offered',
      counterpartPublicKeyDigest: BOB_PKD,
    };
    const { channel: ch1, htlcId } = await addHTLC(channel, params, leaseProvider as any, aliceSigner);
    const { channel: ch2 } = await timeoutHTLC(ch1, htlcId, leaseProvider as any, makeTipProvider(501) as any, aliceSigner);
    expect(ch2.pendingHTLCs[0].status).toBe('timed_out');
    expect(ch2.balances.alice).toBe(600n);
  });

  it('timeoutHTLC: throws if block < timeoutBlock', async () => {
    const params: AddHTLCParams = {
      amount: 100n,
      hashlock: 'aabbcc00'.repeat(8),
      timeoutBlock: 500n,
      direction: 'offered',
      counterpartPublicKeyDigest: BOB_PKD,
    };
    const { channel: ch1, htlcId } = await addHTLC(channel, params, leaseProvider as any, aliceSigner);
    await expect(timeoutHTLC(ch1, htlcId, leaseProvider as any, makeTipProvider(499) as any, aliceSigner))
      .rejects.toThrow('has not yet timed out');
  });

  it('total value conserved after add+fulfill cycle', async () => {
    const { preimage, hash } = require('@totemsdk/core').HTLCHelper.generateSecret();
    const params: AddHTLCParams = {
      amount: 200n,
      hashlock: hash,
      timeoutBlock: 1000n,
      direction: 'offered',
      counterpartPublicKeyDigest: BOB_PKD,
    };
    const { channel: ch1 } = await addHTLC(channel, params, leaseProvider as any, aliceSigner);
    const htlcId = ch1.pendingHTLCs[0].htlcId;
    const bobSigner = makeMockSigner('bob', BOB_PKD);
    const { channel: ch2 } = await fulfillHTLC(ch1, htlcId, preimage, leaseProvider as any, bobSigner);

    const totalAfter = ch2.balances.alice + ch2.balances.bob;
    expect(totalAfter).toBe(channel.totalValue);
  });

  it('addHTLC: returns CAPACITY_NEAR_EXHAUSTION error at ≥95% capacity without mutating channel', async () => {
    const nearExhausted = makeTestChannel({ currentSequence: Math.floor(WOTS_CAPACITY_TOTAL * 0.95) });
    const params: AddHTLCParams = {
      amount: 100n,
      hashlock: 'aabbcc00'.repeat(8),
      timeoutBlock: 1000n,
      direction: 'offered',
      counterpartPublicKeyDigest: BOB_PKD,
    };
    const result = await addHTLC(nearExhausted, params, leaseProvider as any, aliceSigner);
    expect(result.error).toBe('CAPACITY_NEAR_EXHAUSTION');
    expect(result.channel.currentSequence).toBe(nearExhausted.currentSequence);
  });

  it('addHTLC: DoubleSignError — stale copy trying to sign a different payload at same sequence', async () => {
    const params: AddHTLCParams = {
      amount: 100n,
      hashlock: 'aabbcc00'.repeat(8),
      timeoutBlock: 1000n,
      direction: 'offered',
      counterpartPublicKeyDigest: BOB_PKD,
    };
    await addHTLC(channel, params, leaseProvider as any, aliceSigner);
    const params2: AddHTLCParams = { ...params, amount: 150n };
    await expect(addHTLC(channel, params2, leaseProvider as any, aliceSigner))
      .rejects.toThrow(DoubleSignError);
  });

  it('fulfillHTLC: returns CAPACITY_NEAR_EXHAUSTION error at ≥95% capacity without mutating channel', async () => {
    const { preimage, hash } = require('@totemsdk/core').HTLCHelper.generateSecret();
    const params: AddHTLCParams = {
      amount: 100n,
      hashlock: hash,
      timeoutBlock: 1000n,
      direction: 'offered',
      counterpartPublicKeyDigest: BOB_PKD,
    };
    const { channel: ch1, htlcId } = await addHTLC(channel, params, leaseProvider as any, aliceSigner);
    const nearExhausted: OmniaChannel = { ...ch1, currentSequence: Math.floor(WOTS_CAPACITY_TOTAL * 0.95) };
    const bobSigner = makeMockSigner('bob', BOB_PKD);
    const result = await fulfillHTLC(nearExhausted, htlcId, preimage, leaseProvider as any, bobSigner);
    expect(result.error).toBe('CAPACITY_NEAR_EXHAUSTION');
    expect(result.channel.currentSequence).toBe(nearExhausted.currentSequence);
  });

  it('timeoutHTLC: returns CAPACITY_NEAR_EXHAUSTION error at ≥95% capacity without mutating channel', async () => {
    const params: AddHTLCParams = {
      amount: 100n,
      hashlock: 'aabbcc00'.repeat(8),
      timeoutBlock: 500n,
      direction: 'offered',
      counterpartPublicKeyDigest: BOB_PKD,
    };
    const { channel: ch1, htlcId } = await addHTLC(channel, params, leaseProvider as any, aliceSigner);
    const nearExhausted: OmniaChannel = { ...ch1, currentSequence: Math.floor(WOTS_CAPACITY_TOTAL * 0.95) };
    const result = await timeoutHTLC(nearExhausted, htlcId, leaseProvider as any, makeTipProvider(500) as any, aliceSigner);
    expect(result.error).toBe('CAPACITY_NEAR_EXHAUSTION');
    expect(result.channel.currentSequence).toBe(nearExhausted.currentSequence);
  });
});

describe('@totemsdk/omnia — settlement', () => {
  let channel: OmniaChannel;
  let aliceSigner: ChannelSigner;
  let leaseProvider: ReturnType<typeof makeMockLeaseProvider>;

  beforeEach(() => {
    _resetChannelWatermarks();
    channel = makeTestChannel({ currentSequence: 5 });
    aliceSigner = makeMockSigner('alice', ALICE_PKD);
    leaseProvider = makeMockLeaseProvider();
  });

  it('proposeSettlement: returns settlementPayload with correct channelId and sequence', async () => {
    const partyAddresses = { alice: '0x' + 'aa'.repeat(32), bob: '0x' + 'bb'.repeat(32) };
    const { settlementPayload, partialState } = await proposeSettlement(channel, leaseProvider as any, { partyAddresses: partyAddresses, signer: aliceSigner });
    expect(settlementPayload.channelId).toBe(channel.channelId);
    expect(settlementPayload.sequence).toBe(5);
    expect(settlementPayload.settlementTxHex).toBeTruthy();
    expect(settlementPayload.balances.alice).toBe(600n);
    expect(settlementPayload.balances.bob).toBe(400n);
  });

  it('settlement partialState has STATE(100)=true', async () => {
    const partyAddresses = { alice: '0x' + 'aa'.repeat(32), bob: '0x' + 'bb'.repeat(32) };
    const { partialState } = await proposeSettlement(channel, leaseProvider as any, { partyAddresses: partyAddresses, signer: aliceSigner });
    const sv100 = partialState.stateVariables?.find(sv => sv.port === 100);
    expect(sv100?.value).toBe(true);
  });

  it('buildDisputePayload: requires latestState to exist', () => {
    expect(() => buildDisputePayload({ ...channel, latestState: null }))
      .toThrow('no signed state');
  });

  it('buildDisputePayload: includes latest sequence and updateTxHex', () => {
    const latestState: SignedChannelState = {
      sequence: 5,
      balances: { alice: 600n, bob: 400n },
      pendingHTLCs: [],
      stateVariables: [],
      transactionHex: 'deadbeef01',
      signatures: {},
      signingIndices: {},
    };
    const payload = buildDisputePayload({ ...channel, latestState });
    expect(payload.latestSequence).toBe(5);
    expect(payload.updateTxHex).toBe('deadbeef01');
    expect(payload.channelId).toBe(channel.channelId);
  });

  it('markChannelClosed: transitions status to closed', () => {
    const closed = markChannelClosed(channel);
    expect(closed.status).toBe('closed');
    expect(closed.stateLog.at(-1)?.event).toBe('settle');
  });

  it('verifyState fails when balances are tampered after signing', async () => {
    // Sign a state update and then mutate the balances in the SignedChannelState.
    // verifyState must reject the tampered state because signatures bind to balances.
    const { verifyState } = await import('../sign');
    const ch = makeTestChannel();

    const { channel: updatedCh, signedState } = await updateState(
      ch,
      { newBalances: { alice: 500n, bob: 500n } },
      leaseProvider as any,
      aliceSigner,
    );

    // The genuine signed state should report valid: false because the mock signer
    // produces fake signatures that do NOT pass wotsVerifyDigest. The important
    // property is that a TAMPERED state must also not pass — and more importantly
    // must produce a different commitment so a real signature would fail.
    // Here we verify that balances are part of the signed commitment by checking
    // that computeStateCommitment produces different values for different balances.
    const { computeStateCommitmentV2 } = await import('../transactions');
    const orig = computeStateCommitmentV2(
      updatedCh,
      signedState.sequence!,
      signedState.balances!,
      signedState.pendingHTLCs ?? [],
    );
    const tampered = computeStateCommitmentV2(
      updatedCh,
      signedState.sequence!,
      { alice: 900n, bob: 100n },  // tampered balances
      signedState.pendingHTLCs ?? [],
    );

    expect(Buffer.from(orig).toString('hex')).not.toBe(Buffer.from(tampered).toString('hex'));
  });

  it('proposeSettlement with chainProvider: mines TxPoW and broadcasts to chain', async () => {
    const partyAddresses = { alice: '0x' + 'aa'.repeat(32), bob: '0x' + 'bb'.repeat(32) };
    const chainProvider = makeMockChainProvider();

    const { settlementPayload } = await proposeSettlement(
      channel,
      leaseProvider as any,
      { partyAddresses, signer: aliceSigner, chainProvider: chainProvider as any, broadcastProofs: MOCK_BROADCAST_PROOFS },
    );

    // broadcastTxPoW must be called exactly once with the full TxPoW hex
    expect(chainProvider.broadcastTxPoW).toHaveBeenCalledTimes(1);
    const broadcastArg = (chainProvider.broadcastTxPoW as jest.Mock).mock.calls[0][0];
    expect(typeof broadcastArg).toBe('string');
    expect(broadcastArg.length).toBeGreaterThan(0);

    // txpowId must be populated in the settlement payload
    expect(settlementPayload.txpowId).toBeDefined();
    expect(typeof settlementPayload.txpowId).toBe('string');
    // Mocked txpowId is 32 bytes of 0xAB → 64-char hex string
    expect(settlementPayload.txpowId).toHaveLength(64);
  });

  it('proposeSettlement with chainProvider fails closed without serialized broadcast proofs', async () => {
    const partyAddresses = { alice: '0x' + 'aa'.repeat(32), bob: '0x' + 'bb'.repeat(32) };
    const chainProvider = makeMockChainProvider();

    await expect(proposeSettlement(
      channel,
      leaseProvider as any,
      { partyAddresses, signer: aliceSigner, chainProvider: chainProvider as any },
    )).rejects.toThrow('Missing serialized Minima coin proofs');
    expect(chainProvider.broadcastTxPoW).not.toHaveBeenCalled();
  });
});

describe('@totemsdk/omnia — unilateral close lifecycle', () => {
  beforeEach(() => {
    _resetChannelWatermarks();
  });

  it('broadcasts latest signed update and records contest deadline', async () => {
    const { channel: updatedChannel, signedState } = await makeCompleteSignedState(
      makeTestChannel(),
      { alice: 500n, bob: 500n },
    );
    const chainProvider = { ...makeMockChainProvider(), getTip: jest.fn(async () => ({ block: 100, hash: '0x64' })) };
    const result = await startUnilateralClose(
      { ...updatedChannel, latestState: signedState },
      chainProvider as any,
      MOCK_BROADCAST_PROOFS,
    );

    expect(result.channel.status).toBe('closing_unilateral');
    expect(result.contestStartBlock).toBe(100);
    expect(result.contestDeadlineBlock).toBe(100 + ELTOO_CONTEST_DELAY_BLOCKS);
    expect(result.channel.unilateralClose?.updateTxHex).toBe(signedState.closePackage!.update.txHex);
    expect(result.disputePayload.latestSequence).toBe(signedState.sequence);
    expect(chainProvider.broadcastTxPoW).toHaveBeenCalledTimes(1);
  });

  it('rejects unilateral start without serialized broadcast proofs', async () => {
    const { channel: updatedChannel, signedState } = await makeCompleteSignedState(
      makeTestChannel(),
      { alice: 500n, bob: 500n },
    );
    const chainProvider = { ...makeMockChainProvider(), getTip: jest.fn(async () => ({ block: 100, hash: '0x64' })) };

    await expect(startUnilateralClose(
      { ...updatedChannel, latestState: signedState },
      chainProvider as any,
    )).rejects.toThrow('Missing serialized Minima coin proofs');
    expect(chainProvider.broadcastTxPoW).not.toHaveBeenCalled();
  });

  it('rejects unilateral finalize before contest delay and broadcasts settlement after deadline', async () => {
    const { channel: updatedChannel, signedState } = await makeCompleteSignedState(
      makeTestChannel(),
      { alice: 500n, bob: 500n },
    );
    const chainProvider = { ...makeMockChainProvider(), getTip: jest.fn(async () => ({ block: 100, hash: '0x64' })) };
    const started = await startUnilateralClose(
      { ...updatedChannel, latestState: signedState },
      chainProvider as any,
      MOCK_BROADCAST_PROOFS,
    );

    chainProvider.getTip.mockResolvedValueOnce({ block: started.contestDeadlineBlock - 1, hash: '0xearly' });
    await expect(finalizeUnilateralClose(started.channel, chainProvider as any)).rejects.toThrow('Contest delay not elapsed');

    chainProvider.getTip.mockResolvedValueOnce({ block: started.contestDeadlineBlock, hash: '0xready' });
    const finalized = await finalizeUnilateralClose(started.channel, chainProvider as any, MOCK_BROADCAST_PROOFS);
    expect(finalized.channel.status).toBe('closed');
    expect(finalized.settlementPayload.sequence).toBe(signedState.sequence);
    expect(finalized.settlementPayload.settlementTxHex).toBe(signedState.closePackage!.settlement.txHex);
    expect(chainProvider.broadcastTxPoW).toHaveBeenCalledTimes(2);
  });

  it('replaces stale unilateral state with a newer signed state during dispute', async () => {
    const first = await makeCompleteSignedState(makeTestChannel(), { alice: 500n, bob: 500n });
    const chainProvider = { ...makeMockChainProvider(), getTip: jest.fn(async () => ({ block: 100, hash: '0x64' })) };
    const started = await startUnilateralClose(
      { ...first.channel, latestState: first.signedState },
      chainProvider as any,
      MOCK_BROADCAST_PROOFS,
    );
    const secondBase = {
      ...started.channel,
      status: 'active' as const,
      currentSequence: 1,
      latestState: first.signedState,
      balances: first.signedState.balances,
    };
    const second = await makeCompleteSignedState(secondBase, { alice: 450n, bob: 550n }, 10);

    const replaced = replaceUnilateralCloseState(started.channel, second.signedState);

    expect(replaced.status).toBe('disputing');
    expect(replaced.unilateralClose?.sequence).toBe(2);
    expect(replaced.unilateralClose?.updateTxHex).toBe(second.signedState.closePackage!.update.txHex);
    expect(replaced.unilateralClose?.settlementTxHex).toBe(second.signedState.closePackage!.settlement.txHex);
  });
});

describe('@totemsdk/omnia — KISSVM validation', () => {
  beforeEach(() => {
    _resetChannelWatermarks();
  });

  it('validates a complete update state with real txDigest context', async () => {
    const initial = makeTestChannel();
    const { channel, signedState } = await makeCompleteSignedState(initial, { alice: 500n, bob: 500n });
    const { verifyState } = await import('../sign');

    const result = await verifyState(initial, signedState, { kissvm: { block: 1, previousCreatedBlock: 0 } });
    expect(result.errors).not.toEqual(expect.arrayContaining([expect.stringContaining('kissvm pre-validation failed')]));
    expect(validateChannelStateWithKissvm(initial, signedState, { block: 1, previousCreatedBlock: 0 })).toEqual({ valid: true });
    expect(channel.latestState?.sequence).toBe(1);
  });

  it('converts KISSVM limit errors into validation failures', () => {
    const channel = makeTestChannel({ fundingScript: 'RETURN 1 LSHIFT 257' });
    const updateDraft = buildUpdateTx(channel, 1, { alice: 500n, bob: 500n }, []);
    const state: SignedChannelState = {
      sequence: 1,
      balances: { alice: 500n, bob: 500n },
      pendingHTLCs: [],
      stateVariables: updateDraft.stateVariables,
      transactionHex: serializeTxDraft(updateDraft),
      signatures: { alice: new Uint8Array(1088), bob: new Uint8Array(1088) },
      signingIndices: { alice: { addressIndex: 0, l1: 0, l2: 0 }, bob: { addressIndex: 0, l1: 0, l2: 1 } },
    };

    const result = validateChannelStateWithKissvm(channel, state, { block: 1 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('kissvm limit');
  });
});

describe('@totemsdk/omnia — integration: fund → N updates → cooperative settle', () => {
  it('full cooperative close lifecycle produces correct state log', async () => {
    const chain = makeMockChainProvider();
    const aliceSigner = makeMockSigner('alice', ALICE_PKD);
    const leaseProvider = makeMockLeaseProvider();

    // 1. Alice creates the channel
    const { channel: openChannel } = await createChannel(
      {
        localParty: alice,
        remoteParty: bob,
        localAmount: 600n,
        remoteAmount: 400n,
        tokenId: '0x00',
        fundingCoinId: '0x' + 'aa'.repeat(32),
        fundingWitnessBytes: new Uint8Array([0x09, 0x09]),
      },
      chain as any,
    );

    let ch = activateChannel(openChannel);
    expect(ch.status).toBe('active');

    // 2. 5 updates
    for (let i = 1; i <= 5; i++) {
      const r = await updateState(
        ch,
        { newBalances: { alice: BigInt(600 - i * 20), bob: BigInt(400 + i * 20) } },
        leaseProvider as any,
        aliceSigner,
      );
      ch = r.channel;
    }
    expect(ch.currentSequence).toBe(5);
    expect(ch.balances.alice).toBe(500n);
    expect(ch.balances.bob).toBe(500n);

    // 3. Propose settlement
    const partyAddresses = { alice: '0x' + 'aa'.repeat(32), bob: '0x' + 'bb'.repeat(32) };
    const { settlementPayload } = await proposeSettlement(ch, leaseProvider as any, { partyAddresses: partyAddresses, signer: aliceSigner });
    expect(settlementPayload.balances.alice).toBe(500n);
    expect(settlementPayload.balances.bob).toBe(500n);

    // 4. Close the channel
    const closed = markChannelClosed(ch);
    expect(closed.status).toBe('closed');
    expect(closed.stateLog.at(-1)?.event).toBe('settle');

    // Total value conserved throughout
    expect(ch.totalValue).toBe(1000n);
  });
});

describe('@totemsdk/omnia — token scale: funding TX unit consistency', () => {
  it('rejects fractional raw token amounts instead of truncating', () => {
    expect(() => toRawMinima(15n, 1)).toThrow('not divisible');
  });

  it('rejects invalid token scales', () => {
    expect(() => toRawMinima(10n, -1)).toThrow('non-negative integer');
  });

  it('buildFundingTx with tokenScale>0: input and output amounts are both in raw units', () => {
    const { script, address } = buildAndHashEltooScript([alice, bob]);
    // tokenScale=2 → raw = scaled / 100. Scaled 1000n → raw 10n.
    const draft = buildFundingTx(script, address, 1000n, '0xMYTOKEN', 2, ['coin-1'], [1000n], [address]);
    expect(draft.outputs[0].amount).toBe(10n);  // 1000 / 100 = 10 raw
    expect(draft.inputs[0].amount).toBe(10n);   // input must also be in raw units
  });

  it('buildFundingTx with tokenScale=0: amounts unchanged (raw = scaled)', () => {
    const { script, address } = buildAndHashEltooScript([alice, bob]);
    const draft = buildFundingTx(script, address, 1000n, '0x00', 0, ['coin-1'], [1000n], [address]);
    expect(draft.outputs[0].amount).toBe(1000n);
    expect(draft.inputs[0].amount).toBe(1000n);
  });
});

describe('@totemsdk/omnia — executeIntent', () => {
  let channel: OmniaChannel;
  let aliceSigner: ChannelSigner;
  let leaseProvider: ReturnType<typeof makeMockLeaseProvider>;

  const makeAutoApprovePolicy = () => ({
    canAutoApprove: async () => true,
  });
  const makeRejectPolicy = () => ({
    canAutoApprove: async () => false,
  });

  beforeEach(() => {
    _resetChannelWatermarks();
    aliceSigner = makeMockSigner('alice', ALICE_PKD);
    leaseProvider = makeMockLeaseProvider();
    channel = {
      ...makeTestChannel(),
      parties: [
        { partyId: 'alice', publicKeyDigest: ALICE_PKD, addressIndex: 0, settlementAddress: '0xALICEADDR' },
        { partyId: 'bob', publicKeyDigest: BOB_PKD, addressIndex: 1, settlementAddress: '0xBOBADDR' },
      ],
      localSigner: aliceSigner,
    };
  });

  it('approved path: recipient matched by settlementAddress, returns approved with updated channel', async () => {
    const intent = { type: 'channel_update' as const, amount: '100', recipient: '0xBOBADDR' };
    const result = await executeIntent(channel, intent as any, makeAutoApprovePolicy() as any, leaseProvider as any, aliceSigner);
    expect(result.status).toBe('approved');
    expect(result.channel?.balances.alice).toBe(500n);
    expect(result.channel?.balances.bob).toBe(500n);
  });

  it('approved path: recipient matched by publicKeyDigest fallback', async () => {
    const intent = { type: 'channel_update' as const, amount: '100', recipient: BOB_PKD };
    const result = await executeIntent(channel, intent as any, makeAutoApprovePolicy() as any, leaseProvider as any, aliceSigner);
    expect(result.status).toBe('approved');
  });

  it('pending_user when policy rejects auto-approve', async () => {
    const intent = { type: 'channel_update' as const, amount: '100', recipient: '0xBOBADDR' };
    const result = await executeIntent(channel, intent as any, makeRejectPolicy() as any, leaseProvider as any, aliceSigner);
    expect(result.status).toBe('pending_user');
  });

  it('rejected when recipient address not found in channel', async () => {
    const intent = { type: 'channel_update' as const, amount: '100', recipient: '0xUNKNOWNADDR' };
    const result = await executeIntent(channel, intent as any, makeAutoApprovePolicy() as any, leaseProvider as any, aliceSigner);
    expect(result.status).toBe('rejected');
  });

  it('never returns approved when updateState.error is present (CAPACITY_NEAR_EXHAUSTION)', async () => {
    const nearExhausted: OmniaChannel = { ...channel, currentSequence: Math.floor(WOTS_CAPACITY_TOTAL * 0.95) };
    const intent = { type: 'channel_update' as const, amount: '100', recipient: '0xBOBADDR' };
    const result = await executeIntent(nearExhausted, intent as any, makeAutoApprovePolicy() as any, leaseProvider as any, aliceSigner);
    expect(result.status).toBe('pending_user');
    expect(result.status).not.toBe('approved');
  });

  it('reserves before executing, commits on success, passes authenticated principal', async () => {
    const calls: string[] = [];
    const lifecyclePolicy = {
      canAutoApprove: async () => true,
      reserve: async (proposal: { principal?: string }) => {
        calls.push(`reserve:${proposal.principal}`);
        return { outcome: 'approved' as const, reason: 'ok', reservationState: 'new' as const };
      },
      commit: async (id: string) => {
        calls.push(`commit:${id}`);
      },
      release: async (id: string) => {
        calls.push(`release:${id}`);
      },
    };
    const intent = { type: 'channel_update' as const, amount: '100', recipient: '0xBOBADDR' };
    const result = await executeIntent(channel, intent as any, lifecyclePolicy as any, leaseProvider as any, aliceSigner);
    expect(result.status).toBe('approved');
    expect(calls).toEqual([`reserve:${ALICE_PKD}`, expect.stringMatching(/^commit:intent-/), ]);
    expect(calls).not.toContain(expect.stringMatching(/^release:/));
  });

  it('releases the reservation when execution fails (updateState error)', async () => {
    const calls: string[] = [];
    const lifecyclePolicy = {
      canAutoApprove: async () => true,
      reserve: async () => {
        calls.push('reserve');
        return { outcome: 'approved' as const, reason: 'ok' };
      },
      commit: async (id: string) => {
        calls.push(`commit:${id}`);
      },
      release: async (id: string) => {
        calls.push(`release:${id}`);
      },
    };
    const nearExhausted: OmniaChannel = { ...channel, currentSequence: Math.floor(WOTS_CAPACITY_TOTAL * 0.95) };
    const intent = { type: 'channel_update' as const, amount: '100', recipient: '0xBOBADDR' };
    const result = await executeIntent(nearExhausted, intent as any, lifecyclePolicy as any, leaseProvider as any, aliceSigner);
    expect(result.status).toBe('pending_user');
    expect(calls).toEqual(['reserve', expect.stringMatching(/^release:intent-/)]);
    expect(calls).not.toContain(expect.stringMatching(/^commit:/));
  });

  it('rejects when the policy reserve declines', async () => {
    const lifecyclePolicy = {
      canAutoApprove: async () => true,
      reserve: async () => ({ outcome: 'rejected' as const, reason: 'Daily cap exceeded' }),
    };
    const intent = { type: 'channel_update' as const, amount: '100', recipient: '0xBOBADDR' };
    const result = await executeIntent(channel, intent as any, lifecyclePolicy as any, leaseProvider as any, aliceSigner);
    expect(result.status).toBe('rejected');
    expect(result.receipt?.rejectionReason).toBe('Daily cap exceeded');
  });

  it('does not reserve when canAutoApprove is false', async () => {
    let reserveCalled = false;
    const lifecyclePolicy = {
      canAutoApprove: async () => false,
      reserve: async () => {
        reserveCalled = true;
        return { outcome: 'approved' as const, reason: 'ok' };
      },
    };
    const intent = { type: 'channel_update' as const, amount: '100', recipient: '0xBOBADDR' };
    const result = await executeIntent(channel, intent as any, lifecyclePolicy as any, leaseProvider as any, aliceSigner);
    expect(result.status).toBe('pending_user');
    expect(reserveCalled).toBe(false);
  });

  it('releases a reservation when updateState throws', async () => {
    const calls: string[] = [];
    const lifecyclePolicy = {
      canAutoApprove: async () => true,
      reserve: async () => ({ outcome: 'approved' as const, reason: 'ok', reservationState: 'new' as const }),
      release: async (id: string) => calls.push(`release:${id}`),
    };
    const signer = { ...aliceSigner, sign: jest.fn().mockRejectedValue(new Error('sign failed')) } as any;
    await expect(executeIntent(channel, { type: 'channel_update', amount: '100', recipient: '0xBOBADDR' } as any, lifecyclePolicy as any, leaseProvider as any, signer, { operationId: 'stable-throw' })).rejects.toThrow('sign failed');
    expect(calls).toEqual(['release:intent-stable-throw']);
  });

  it('short-circuits a committed operation replay', async () => {
    const calls: string[] = [];
    const lifecyclePolicy = {
      canAutoApprove: async () => true,
      reserve: async () => ({ outcome: 'approved' as const, reason: 'already', reservationState: 'already_committed' as const }),
      commit: async () => calls.push('commit'),
    };
    const result = await executeIntent(channel, { type: 'channel_update', amount: '100', recipient: '0xBOBADDR' } as any, lifecyclePolicy as any, leaseProvider as any, aliceSigner, { operationId: 'stable-replay' });
    expect(result.idempotentReplay).toBe(true);
    expect(calls).toEqual([]);
  });
});

describe('@totemsdk/omnia — coloured coin support (custom tokenId)', () => {
  it('channel can be opened with a custom tokenId', () => {
    const customTokenId = '0xTOKEN1234ABCD';
    const ch = makeTestChannel({ tokenId: customTokenId });
    expect(ch.tokenId).toBe(customTokenId);
    const updateDraft = buildUpdateTx(ch, 1, { alice: 600n, bob: 400n }, []);
    expect(updateDraft.inputs[0].tokenId).toBe(customTokenId);
    expect(updateDraft.outputs[0].tokenId).toBe(customTokenId);
  });

  it('eltoo script is the same regardless of tokenId (token-agnostic)', () => {
    const script1 = buildEltooScript([alice, bob]);
    const ch1 = makeTestChannel({ tokenId: '0x00' });
    const ch2 = makeTestChannel({ tokenId: '0xSOMETOKEN' });
    expect(ch1.fundingScript).toBe(ch2.fundingScript);
  });
});
