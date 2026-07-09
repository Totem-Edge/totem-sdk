import { bytesToHex, concatBytes } from '@totemsdk/core';
import { mineTxPoW, TX_POW_MIN_DIFFICULTY, serializeTxBody } from '@totemsdk/txpow';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type {
  OmniaChannel,
  CreateChannelParams,
  ChannelProposal,
  UpdateDelta,
  UpdateStateResult,
  ChannelReceipt,
  SignedChannelState,
  ChannelSigner,
  ChannelLogEntry,
} from './types.js';
import { buildAndHashEltooScript } from './script.js';
import { buildFundingTx, buildUpdateTx, computeStateCommitment, omniaDraftToMinimaBytes } from './transactions.js';
import { assessCapacity, WOTS_CAPACITY_TOTAL, flatSigningIndex } from './capacity.js';
import { signState } from './sign.js';
import { ChannelStatusError, SigningIndexMonotonicityError, DoubleSignError, SequenceError } from './errors.js';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level sequence watermarks
//
// Persist the most-recently-signed (sequence, payloadHash) per channel ID.
// Because JavaScript is single-threaded, this map is always consistent within
// one process. It provides authoritative enforcement that is independent of
// the mutable channel object: stale copies can never sign a different payload
// at a sequence that has already been committed, and the sequence number can
// never go backwards regardless of which channel object a caller holds.
// ─────────────────────────────────────────────────────────────────────────────
const _channelWatermarks = new Map<string, { sequence: number; payloadHash: string }>();

/**
 * Enforce all per-update invariants that must hold for every state transition
 * regardless of whether the caller is `updateState`, `addHTLC`, `fulfillHTLC`,
 * or `timeoutHTLC`.
 *
 * Specifically:
 *   1. WOTS capacity check: throws `ChannelCapacityError` at 100%, returns
 *      `'CAPACITY_NEAR_EXHAUSTION'` at 95% (caller must NOT advance watermark).
 *   2. Stale-sequence guard (SequenceError): rejects any attempt to sign a
 *      sequence that is behind the module-level watermark.
 *   3. Double-sign guard (DoubleSignError): rejects a different payload at a
 *      sequence already committed by this process.
 *   4. Watermark advance: after all guards pass, records `(newSequence,
 *      payloadHash)` synchronously — before any async work — so no concurrent
 *      call can slip in between the guard and the WOTS reservation.
 *
 * @param channelId   - Channel identifier for the watermark map key.
 * @param newSequence - Proposed next sequence number.
 * @param payloadHash - Hex-encoded SHA3-256 of the full off-chain state
 *                     commitment (sequence + balances + pending HTLCs).
 * @returns `'CAPACITY_NEAR_EXHAUSTION'` when signing is blocked at the 95%
 *          threshold; `null` when signing may proceed.
 */
export function enforceUpdateGuards(
  channelId: string,
  newSequence: number,
  payloadHash: string,
): 'CAPACITY_NEAR_EXHAUSTION' | null {
  // 1. Capacity — throws ChannelCapacityError at 100%, nearExhaustion at 95%.
  const { nearExhaustion } = assessCapacity(newSequence);

  // 2/3. Watermark: stale-sequence and double-sign protection.
  const watermark = _channelWatermarks.get(channelId);
  if (watermark) {
    if (watermark.sequence > newSequence) {
      throw new SequenceError(watermark.sequence, newSequence);
    }
    if (watermark.sequence === newSequence && watermark.payloadHash !== payloadHash) {
      throw new DoubleSignError(newSequence);
    }
  }

  // Block without consuming the watermark slot — caller retries or settles.
  if (nearExhaustion) {
    return 'CAPACITY_NEAR_EXHAUSTION';
  }

  // 4. Advance watermark synchronously before any async signing work.
  _channelWatermarks.set(channelId, { sequence: newSequence, payloadHash });
  return null;
}

/**
 * Reset all channel sequence watermarks.
 * Intended only for test isolation — call in `beforeEach` to prevent watermarks
 * from bleeding between tests that share a fixed `channelId`.
 */
export function _resetChannelWatermarks(): void {
  _channelWatermarks.clear();
}

const TOKENID_MINIMA = '0x00';

function generateChannelId(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return '0x' + buf.reduce((hex, b) => hex + b.toString(16).padStart(2, '0'), '');
}

function logEntry(
  channel: OmniaChannel,
  event: ChannelLogEntry['event'],
): ChannelLogEntry {
  return {
    sequence: channel.currentSequence,
    timestamp: Date.now(),
    balances: { ...channel.balances },
    htlcCount: channel.pendingHTLCs.filter(h => h.status === 'pending').length,
    event,
  };
}

export async function createChannel(
  params: CreateChannelParams,
  chainProvider: ChainStateProvider,
): Promise<{ channel: OmniaChannel; proposal: ChannelProposal }> {
  const parties = [params.localParty, params.remoteParty];
  const { script, address } = buildAndHashEltooScript(parties);
  const tokenId = params.tokenId ?? TOKENID_MINIMA;
  const tokenScale = params.tokenScale ?? 0;
  const totalValue = params.localAmount + params.remoteAmount;

  const fundingDraft = buildFundingTx(
    script,
    address,
    totalValue,
    tokenId,
    tokenScale,
    [params.fundingCoinId],
    [totalValue],
    [address],
  );

  // Build canonical Minima TX bytes, mine PoW, assemble full TxPoW, and broadcast.
  // The funding coin is signed by the wallet layer; the omnia package provides an
  // empty witness here — the host application attaches the wallet coin proof before
  // or after the mineTxPoW call as required by the chain integration.
  const fundingTxBytes = omniaDraftToMinimaBytes(fundingDraft);
  const txBody = serializeTxBody(fundingTxBytes, new Uint8Array(0));
  const mined = await mineTxPoW(txBody, TX_POW_MIN_DIFFICULTY);
  const fullTxPoW = concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01]), txBody);
  const broadcast = await chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));
  const fundingTxId = broadcast.txpowid ?? Buffer.from(mined.txpowId).toString('hex');
  const fundingCoinId = `${fundingTxId}-0`;

  if (params.tokenId && params.tokenId !== TOKENID_MINIMA) {
    const tokenInfo = await chainProvider.getToken(params.tokenId);
    if (tokenInfo.script && tokenInfo.script.trim().toUpperCase() !== 'RETURN TRUE') {
      console.warn(
        `[omnia] channel opened with non-trivial tokenScript for token ${params.tokenId}. ` +
        `Ensure the tokenScript is compatible with eltoo update/settlement flow.`
      );
    }
  }

  const channelId = generateChannelId();

  const balances: Record<string, bigint> = {
    [params.localParty.partyId]: params.localAmount,
    [params.remoteParty.partyId]: params.remoteAmount,
  };

  const channel: OmniaChannel = {
    channelId,
    fundingTxId,
    fundingCoinId,
    fundingScript: script,
    fundingAddress: address,
    tokenId,
    tokenScale,
    totalValue,
    parties,
    balances,
    pendingHTLCs: [],
    currentSequence: 0,
    latestState: null,
    stateLog: [],
    status: 'opening',
    channelType: params.channelType ?? 'direct',
    factoryRef: params.factoryRef,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  channel.stateLog.push(logEntry(channel, 'open'));

  const proposal: ChannelProposal = {
    channelId,
    localParty: params.localParty,
    remoteParty: params.remoteParty,
    localAmount: params.localAmount,
    remoteAmount: params.remoteAmount,
    tokenId,
    tokenScale,
    fundingScript: script,
    fundingAddress: address,
    fundingTxId,
    fundingCoinId,
  };

  return { channel, proposal };
}

/**
 * Bob's side: validates an inbound channel proposal and returns an active channel.
 * Recomputes the script from the proposal's parties and validates it matches the
 * claimed fundingScript (tampering detection).
 *
 * @param proposal  - Inbound channel proposal from the initiating party.
 * @param provider  - Optional chain provider for on-chain funding TX validation.
 */
export function acceptChannel(
  proposal: ChannelProposal,
  provider?: ChainStateProvider,
): OmniaChannel {
  const parties = [proposal.localParty, proposal.remoteParty];
  const { script, address } = buildAndHashEltooScript(parties);

  if (script !== proposal.fundingScript) {
    throw new Error('Script mismatch: recomputed script does not match proposal');
  }

  const totalValue = proposal.localAmount + proposal.remoteAmount;
  const balances: Record<string, bigint> = {
    [proposal.localParty.partyId]: proposal.localAmount,
    [proposal.remoteParty.partyId]: proposal.remoteAmount,
  };

  const channel: OmniaChannel = {
    channelId: proposal.channelId,
    fundingTxId: proposal.fundingTxId,
    fundingCoinId: proposal.fundingCoinId,
    fundingScript: proposal.fundingScript,
    fundingAddress: proposal.fundingAddress ?? address,
    tokenId: proposal.tokenId,
    tokenScale: proposal.tokenScale ?? 0,
    totalValue,
    parties,
    balances,
    pendingHTLCs: [],
    currentSequence: 0,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  channel.stateLog.push(logEntry(channel, 'open'));
  return channel;
}

/**
 * Produce a new partial SignedChannelState with incremented sequence.
 *
 * Spec: `updateState(channel, delta, leaseProvider)` — signer is optional and
 * falls back to `channel.localSigner` when not provided.
 *
 * @param channel        - Current channel state (must be 'active').
 * @param delta          - Balance delta: `{ newBalances, memo? }`.
 * @param leaseProvider  - WOTS lease provider for key slot management.
 * @param signer         - Optional explicit signer; falls back to channel.localSigner.
 */
export async function updateState(
  channel: OmniaChannel,
  delta: UpdateDelta,
  leaseProvider: WotsLeaseProvider,
  signer?: ChannelSigner,
): Promise<UpdateStateResult> {
  if (channel.status !== 'active') {
    throw new ChannelStatusError('active', channel.status);
  }

  const effectiveSigner = signer ?? channel.localSigner;
  if (!effectiveSigner) throw new Error('No signer provided and channel.localSigner is not set');

  const signerParty = channel.parties.find(p => p.publicKeyDigest === effectiveSigner.publicKeyDigest);
  if (!signerParty) throw new Error('Signer public key digest not found in channel parties');

  const newSequence = channel.currentSequence + 1;

  // Validate balance conservation.
  const htlcTotal = channel.pendingHTLCs
    .filter(h => h.status === 'pending')
    .reduce((a, h) => a + h.amount, 0n);
  const balanceSum = Object.values(delta.newBalances).reduce((a, b) => a + b, 0n);
  if (balanceSum + htlcTotal !== channel.totalValue) {
    const { BalanceConservationError } = await import('./errors.js');
    throw new BalanceConservationError(channel.totalValue, balanceSum + htlcTotal);
  }

  // Compute state commitment (fail-fast, before any async work) then run all
  // per-update invariants through the shared enforceUpdateGuards path —
  // capacity, watermark double-sign / stale-sequence, and watermark advance.
  const commitment = computeStateCommitment(newSequence, delta.newBalances, channel.pendingHTLCs);
  const payloadHash = bytesToHex(commitment);
  const guardError = enforceUpdateGuards(channel.channelId, newSequence, payloadHash);
  if (guardError) {
    return { channel, signedState: {}, error: guardError };
  }

  const partialState = await signState(
    channel,
    { newSequence, newBalances: delta.newBalances },
    leaseProvider,
    effectiveSigner,
  );

  // Signing index monotonicity: new flat index must exceed the previous one.
  const indices = partialState.signingIndices![signerParty.partyId];
  if (channel.latestState) {
    const prevIndices = channel.latestState.signingIndices[signerParty.partyId];
    if (prevIndices) {
      const prevFlat = flatSigningIndex(prevIndices.l1, prevIndices.l2);
      const newFlat = flatSigningIndex(indices.l1, indices.l2);
      if (newFlat <= prevFlat) {
        throw new SigningIndexMonotonicityError(
          signerParty.partyId,
          prevFlat,
          newFlat,
        );
      }
    }
  }

  const updatedChannel: OmniaChannel = {
    ...channel,
    balances: delta.newBalances,
    currentSequence: newSequence,
    pendingProposal: { sequence: newSequence, payloadHash },
    updatedAt: Date.now(),
  };

  updatedChannel.stateLog = [
    ...channel.stateLog,
    {
      sequence: newSequence,
      timestamp: Date.now(),
      balances: { ...delta.newBalances },
      htlcCount: channel.pendingHTLCs.filter(h => h.status === 'pending').length,
      event: 'update',
    },
  ];

  return { channel: updatedChannel, signedState: partialState };
}

export function attachCounterpartySignature(
  channel: OmniaChannel,
  partialState: Partial<SignedChannelState>,
  counterPartyId: string,
  counterSignature: import('./types.js').ChannelSignature,
  counterIndices: import('@totemsdk/wots-lease').SigningIndices,
): { channel: OmniaChannel; signedState: SignedChannelState } {
  if (!partialState.sequence || !partialState.balances || !partialState.transactionHex) {
    throw new Error('Partial state is incomplete');
  }

  const signedState: SignedChannelState = {
    sequence: partialState.sequence,
    balances: partialState.balances,
    pendingHTLCs: partialState.pendingHTLCs ?? [],
    stateVariables: partialState.stateVariables ?? [],
    transactionHex: partialState.transactionHex,
    signatures: {
      ...(partialState.signatures ?? {}),
      [counterPartyId]: counterSignature,
    },
    signingIndices: {
      ...(partialState.signingIndices ?? {}),
      [counterPartyId]: counterIndices,
    },
  };

  const updatedChannel: OmniaChannel = {
    ...channel,
    latestState: signedState,
    updatedAt: Date.now(),
  };

  return { channel: updatedChannel, signedState };
}

export function getChannelReceipt(
  channel: OmniaChannel,
  state: SignedChannelState,
): ChannelReceipt {
  const capacityUsed = state.sequence;
  const { warning } = assessCapacity(Math.min(capacityUsed, WOTS_CAPACITY_TOTAL - 1));

  return {
    channelId: channel.channelId,
    sequence: state.sequence,
    balances: { ...state.balances },
    capacityWarning: warning,
    capacityUsed,
    capacityTotal: WOTS_CAPACITY_TOTAL,
    timestamp: Date.now(),
  };
}

export function activateChannel(channel: OmniaChannel): OmniaChannel {
  return { ...channel, status: 'active', updatedAt: Date.now() };
}
