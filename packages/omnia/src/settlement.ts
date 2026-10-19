import { concatBytes } from '@totemsdk/core';
import { mineTxPoW, resolveTxPowTarget, serializeTxBody } from '@totemsdk/txpow';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { WotsLeaseProvider, SigningIndices } from '@totemsdk/wots-lease';
import type {
  OmniaChannel,
  SignedChannelState,
  SettlementPayload,
  DisputePayload,
  ChannelSigner,
  ChannelSignature,
  UnilateralCloseStartResult,
  UnilateralCloseFinalizeResult,
} from './types.js';
import { ChannelStatusError } from './errors.js';
import { buildSettlementTx, deserializeTxDraft, serializeTxDraft, omniaDraftToCanonicalMinimaBytes, computeOmniaTxDigest } from './transactions.js';
import { signTxDraft } from './sign.js';
import { verifyClosePackage } from './close-package.js';
import { ELTOO_CONTEST_DELAY_BLOCKS } from './script.js';
import {
  assertBroadcastProofs,
  closePackageSignatureBytes,
  serializeOmniaWitness,
  type OmniaWitnessProofs,
} from './witness.js';

export interface ProposeSettlementOptions {
  /** Explicit signer — falls back to channel.localSigner when not provided. */
  signer?: ChannelSigner;
  /**
   * Per-party settlement output addresses.
   * Falls back to `party.settlementAddress` for each party when not provided.
   * If neither is available, throws an error.
   */
  partyAddresses?: Record<string, string>;
  /**
   * Chain provider for TxPoW mining and broadcast.
   * When provided, the settlement TX is mined (SHA3-256 PoW) and broadcast
   * to the Minima network via `chainProvider.broadcastTxPoW`. The mined
   * TxPoW ID is returned as `settlementPayload.txpowId`.
   * When omitted, the payload is built and signed off-chain only (useful
   * for cooperative multi-sig flows where the counterparty broadcasts).
   */
  chainProvider?: ChainStateProvider;
  broadcastProofs?: OmniaWitnessProofs;
  /**
   * Exact settlement draft (serialized) that the counterparty signed. When set,
   * this is used verbatim so both signatures cover identical bytes.
   */
  settlementTxHex?: string;
  /**
   * Counterparty signatures to include alongside the local one. The eltoo
   * settlement branch requires `MULTISIG(2 A B)`, so a cooperative settlement
   * needs both signatures in the witness.
   */
  counterpartySignatures?: Array<{ partyId: string; signature: ChannelSignature }>;
}

/** A settlement draft + digest offered to the counterparty for co-signing. */
export interface SettlementSigningRequest {
  channelId: string;
  sequence: number;
  settlementTxHex: string;
  digestHex: string;
  partyAddresses: Record<string, string>;
}

function resolveSettlementState(channel: OmniaChannel): SignedChannelState {
  const current: SignedChannelState = channel.latestState ?? {
    sequence: channel.currentSequence,
    balances: channel.balances,
    pendingHTLCs: channel.pendingHTLCs,
    stateVariables: [
      { port: 100, value: false, type: 'bool' as const },
      { port: 101, value: BigInt(channel.currentSequence), type: 'number' as const },
    ],
    transactionHex: '',
    signatures: {},
    signingIndices: {},
  };
  // The eltoo SETTLEMENT branch requires SEQUENCE EQ PREVSEQUENCE, i.e. the
  // sequence stored on the *on-chain* channel coin. Off-chain updates advance
  // `currentSequence` but not the chain coin until an update tx is broadcast.
  // A cooperative close therefore settles at the on-chain sequence while
  // distributing the agreed (post-payment) balances.
  return { ...current, sequence: channel.onChainSequence ?? 0 };
}

function resolveSettlementPartyAddresses(
  channel: OmniaChannel,
  partyAddresses?: Record<string, string>,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const party of channel.parties) {
    const addr = partyAddresses?.[party.partyId] ?? party.settlementAddress;
    if (!addr) {
      throw new Error(
        `No settlement address for party ${party.partyId}. ` +
        `Set party.settlementAddress or pass opts.partyAddresses.`
      );
    }
    resolved[party.partyId] = addr;
  }
  return resolved;
}

/**
 * Build the deterministic settlement draft + digest for a cooperative close.
 * Both parties can build this independently from the same channel state, or the
 * settling party can send it verbatim to the counterparty to co-sign.
 */
export function buildSettlementSigningRequest(
  channel: OmniaChannel,
  opts?: Pick<ProposeSettlementOptions, 'partyAddresses'>,
): SettlementSigningRequest {
  const state = resolveSettlementState(channel);
  const partyAddresses = resolveSettlementPartyAddresses(channel, opts?.partyAddresses);
  const draft = buildSettlementTx(channel, state, partyAddresses);
  return {
    channelId: channel.channelId,
    sequence: state.sequence,
    settlementTxHex: serializeTxDraft(draft),
    digestHex: '0x' + Buffer.from(computeOmniaTxDigest(draft)).toString('hex'),
    partyAddresses,
  };
}

/**
 * Co-sign a settlement signing request. Used by the counterparty to provide its
 * half of the eltoo `MULTISIG(2 …)` settlement witness.
 */
export async function signSettlementRequest(
  channel: OmniaChannel,
  request: SettlementSigningRequest,
  leaseProvider: WotsLeaseProvider,
  signer?: ChannelSigner,
): Promise<{ partyId: string; signature: ChannelSignature; indices: SigningIndices }> {
  const effectiveSigner = signer ?? channel.localSigner;
  if (!effectiveSigner) throw new Error('No signer provided and channel.localSigner is not set');
  const signerParty = channel.parties.find(p => p.publicKeyDigest === effectiveSigner.publicKeyDigest);
  if (!signerParty) throw new Error('Signer is not a channel participant');

  const draft = deserializeTxDraft(request.settlementTxHex);
  const { signature, indices } = await signTxDraft(
    channel,
    draft,
    `settlement-sign-seq-${request.sequence}`,
    leaseProvider,
    effectiveSigner,
  );
  return { partyId: signerParty.partyId, signature, indices };
}

async function mineAndBroadcastDraft(
  txHex: string,
  chainProvider: ChainStateProvider,
  witnessBytes: Uint8Array,
): Promise<string | undefined> {
  const draftBytes = omniaDraftToCanonicalMinimaBytes(deserializeTxDraft(txHex));
  const txnDifficulty = await resolveTxPowTarget(chainProvider);
  const txBody = serializeTxBody(draftBytes, witnessBytes, { txnDifficulty });
  const mined = await mineTxPoW(txBody, txnDifficulty);
  const fullTxPoW = concatBytes(concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01])), txBody);
  const broadcast = await chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));
  if (broadcast.success === false) {
    throw new Error(`Settlement broadcast failed: ${broadcast.message ?? 'unknown error'}`);
  }
  return broadcast.txpowid ?? Buffer.from(mined.txpowId).toString('hex');
}

/**
 * Builds the cooperative settlement TX (`STATE(100)=TRUE`) and signs it with the
 * settlement TX digest — critical for on-chain correctness.
 *
 * Full chain path (when `opts.chainProvider` is provided):
 *   1. Build settlement draft (STATE(100)=TRUE, per-party outputs).
 *   2. Sign the settlement TX digest via the WOTS lease.
 *   3. Serialize draft bytes + witness bytes → `serializeTxBody()` (txpow TxBody).
 *   4. Mine PoW via `mineTxPoW()` using `TX_POW_MIN_DIFFICULTY`.
 *   5. Assemble full TxPoW: `minedHeaderBytes || 0x01 || txBody`.
 *   6. Broadcast via `chainProvider.broadcastTxPoW()`.
 *
 * Spec: `proposeSettlement(channel, leaseProvider)` — signer and partyAddresses are
 * optional via the opts argument and fall back to channel fields.
 */
export async function proposeSettlement(
  channel: OmniaChannel,
  leaseProvider: WotsLeaseProvider,
  opts?: ProposeSettlementOptions,
): Promise<{ settlementPayload: SettlementPayload; partialState: Partial<SignedChannelState> }> {
  if (!['active', 'closing_mutual'].includes(channel.status)) {
    throw new ChannelStatusError(['active', 'closing_mutual'], channel.status);
  }

  const effectiveSigner = opts?.signer ?? channel.localSigner;
  if (!effectiveSigner) throw new Error('No signer provided and channel.localSigner is not set');

  const signerParty = channel.parties.find(p => p.publicKeyDigest === effectiveSigner.publicKeyDigest);
  if (!signerParty) throw new Error('Signer is not a channel participant');

  const partyAddresses = resolveSettlementPartyAddresses(channel, opts?.partyAddresses);
  const state = resolveSettlementState(channel);

  // Prefer the exact draft the counterparty co-signed so both signatures cover
  // identical bytes; otherwise build it deterministically from channel state.
  const settlementDraft = opts?.settlementTxHex
    ? deserializeTxDraft(opts.settlementTxHex)
    : buildSettlementTx(channel, state, partyAddresses);
  const settlementHex = opts?.settlementTxHex ?? serializeTxDraft(settlementDraft);

  // signTxDraft signs the settlement TX (STATE(100)=TRUE), not the update TX.
  const { signature, indices } = await signTxDraft(
    channel,
    settlementDraft,
    `settlement-seq-${state.sequence}`,
    leaseProvider,
    effectiveSigner,
  );

  const htlcOutputs = state.pendingHTLCs
    .filter(h => h.status === 'pending')
    .map(h => ({
      htlcId: h.htlcId,
      amount: h.amount,
      htlcTxHex: '',
    }));

  const settlementPayload: SettlementPayload = {
    channelId: channel.channelId,
    sequence: state.sequence,
    settlementTxHex: settlementHex,
    balances: { ...state.balances },
    htlcOutputs,
  };

  // ── Full TxPoW mining + chain broadcast ──────────────────────────────────
  // When chainProvider is supplied, produce a chain-ready TxPoW:
  //   omniaDraftToCanonicalMinimaBytes() → canonical Minima TX bytes
  //   + witness → serializeTxBody → mineTxPoW
  //   → concat(minedHeader, 0x01, txBody) → broadcastTxPoW
  if (opts?.chainProvider) {
    assertBroadcastProofs(opts.broadcastProofs);
    const draftBytes = omniaDraftToCanonicalMinimaBytes(settlementDraft);
    // Include the counterparty signature(s) too: the eltoo settlement branch
    // requires MULTISIG(2 A B), so a cooperative close needs both keys present.
    const signatures = [
      signature,
      ...(opts.counterpartySignatures ?? []).map((s) => s.signature),
    ];
    const witnessBytes = serializeOmniaWitness({
      // `signature` is already a serialized Minima/Tree Signature; the lease
      // indices are channel metadata and must NOT be prepended to the witness
      // (doing so makes the node's TxPoW parser reject the body).
      signatures,
      coinProofs: opts.broadcastProofs.coinProofs,
      scriptProofs: opts.broadcastProofs.scriptProofs,
    });

    if (opts.chainProvider.submitTransaction) {
      // Node builds the TxPoW header (real block number/difficulty/magic),
      // mines, and we post it — the reliable explicit-mine path.
      const submitted = await opts.chainProvider.submitTransaction(draftBytes, witnessBytes);
      if (submitted.success === false || !submitted.txpowid) {
        throw new Error(`Settlement submission failed: ${submitted.message ?? 'no txpowid'}`);
      }
      settlementPayload.txpowId = submitted.txpowid;
    } else {
      const txnDifficulty = await resolveTxPowTarget(opts.chainProvider);
      const txBody = serializeTxBody(draftBytes, witnessBytes, { txnDifficulty });

      const mined = await mineTxPoW(txBody, txnDifficulty);

      // Full TxPoW = TxHeader bytes + MiniByte(0x01=hasBody) + TxBody bytes
      const fullTxPoW = concatBytes(concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01])), txBody);
      const broadcast = await opts.chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));
      if (broadcast.success === false) {
        throw new Error(`Settlement broadcast failed: ${broadcast.message ?? 'unknown error'}`);
      }

      settlementPayload.txpowId = Buffer.from(mined.txpowId).toString('hex');
    }
  }

  const partialState: Partial<SignedChannelState> = {
    sequence: state.sequence,
    balances: state.balances,
    pendingHTLCs: state.pendingHTLCs,
    stateVariables: settlementDraft.stateVariables,
    transactionHex: settlementHex,
    signatures: {
      [signerParty.partyId]: signature,
      ...Object.fromEntries((opts?.counterpartySignatures ?? []).map((s) => [s.partyId, s.signature])),
    },
    signingIndices: { [signerParty.partyId]: indices },
  };

  return { settlementPayload, partialState };
}

export function buildDisputePayload(
  channel: OmniaChannel,
  evidence?: string,
): DisputePayload {
  const latest = channel.latestState;
  if (!latest) {
    throw new Error('Cannot build dispute payload: no signed state available');
  }

  return {
    channelId: channel.channelId,
    latestSequence: latest.sequence,
    updateTxHex: latest.transactionHex,
    stateLog: channel.stateLog,
    evidence: evidence ?? JSON.stringify(latest.stateVariables),
  };
}

export async function startUnilateralClose(
  channel: OmniaChannel,
  chainProvider: ChainStateProvider,
  broadcastProofs?: OmniaWitnessProofs,
): Promise<UnilateralCloseStartResult> {
  if (!['active', 'closing_unilateral', 'disputing'].includes(channel.status)) {
    throw new ChannelStatusError(['active', 'closing_unilateral', 'disputing'], channel.status);
  }

  const latest = channel.latestState;
  if (!latest) throw new Error('Cannot start unilateral close: no signed state available');
  const closePackageCheck = verifyClosePackage(channel, latest);
  if (!closePackageCheck.valid) {
    throw new Error(`Cannot start unilateral close: ${closePackageCheck.errors.join('; ')}`);
  }
  const closePackage = latest.closePackage!;
  assertBroadcastProofs(broadcastProofs);

  const tip = await chainProvider.getTip();
  const updateTxpowId = await mineAndBroadcastDraft(
    closePackage.update.txHex,
    chainProvider,
    serializeOmniaWitness({
      signatures: closePackageSignatureBytes(latest, 'update'),
      coinProofs: broadcastProofs.coinProofs,
      scriptProofs: broadcastProofs.scriptProofs,
    }),
  );
  const contestDeadlineBlock = tip.block + ELTOO_CONTEST_DELAY_BLOCKS;
  const disputePayload = buildDisputePayload(channel, JSON.stringify({
    stateCommitmentV2: closePackage.stateCommitmentV2,
    updateTxDigest: closePackage.update.txDigest,
    settlementTxDigest: closePackage.settlement.txDigest,
  }));

  const updatedChannel: OmniaChannel = {
    ...channel,
    status: 'closing_unilateral',
    unilateralClose: {
      channelId: channel.channelId,
      sequence: latest.sequence,
      updateTxHex: closePackage.update.txHex,
      settlementTxHex: closePackage.settlement.txHex,
      contestStartBlock: tip.block,
      contestDeadlineBlock,
      status: 'update_broadcast',
      updateTxpowId,
    },
    updatedAt: Date.now(),
  };

  return {
    channel: updatedChannel,
    disputePayload,
    contestStartBlock: tip.block,
    contestDeadlineBlock,
    updateTxpowId,
  };
}

export async function finalizeUnilateralClose(
  channel: OmniaChannel,
  chainProvider: ChainStateProvider,
  broadcastProofs?: OmniaWitnessProofs,
): Promise<UnilateralCloseFinalizeResult> {
  if (channel.status !== 'closing_unilateral' && channel.status !== 'disputing') {
    throw new ChannelStatusError(['closing_unilateral', 'disputing'], channel.status);
  }
  const closeState = channel.unilateralClose;
  if (!closeState) throw new Error('Cannot finalize unilateral close: no unilateral close in progress');
  const tip = await chainProvider.getTip();
  if (tip.block < closeState.contestDeadlineBlock) {
    throw new Error(`Contest delay not elapsed: current block ${tip.block}, deadline ${closeState.contestDeadlineBlock}`);
  }

  assertBroadcastProofs(broadcastProofs);

  const latest = channel.latestState;
  if (!latest) throw new Error('Cannot finalize unilateral close: no signed state available');
  const settlementTxpowId = await mineAndBroadcastDraft(
    closeState.settlementTxHex,
    chainProvider,
    serializeOmniaWitness({
      signatures: closePackageSignatureBytes(latest, 'settlement'),
      coinProofs: broadcastProofs.coinProofs,
      scriptProofs: broadcastProofs.scriptProofs,
    }),
  );
  const htlcOutputs = latest.pendingHTLCs
    .filter(h => h.status === 'pending')
    .map(h => ({ htlcId: h.htlcId, amount: h.amount, htlcTxHex: '' }));
  const settlementPayload: SettlementPayload = {
    channelId: channel.channelId,
    sequence: closeState.sequence,
    settlementTxHex: closeState.settlementTxHex,
    balances: { ...latest.balances },
    htlcOutputs,
    txpowId: settlementTxpowId,
  };

  const updatedChannel = markChannelClosed({
    ...channel,
    unilateralClose: {
      ...closeState,
      status: 'settlement_broadcast',
      settlementTxpowId,
    },
    updatedAt: Date.now(),
  });

  return { channel: updatedChannel, settlementPayload };
}

export function replaceUnilateralCloseState(
  channel: OmniaChannel,
  newerState: SignedChannelState,
): OmniaChannel {
  if (!channel.unilateralClose) {
    throw new Error('Cannot replace unilateral close state: no unilateral close in progress');
  }
  if (newerState.sequence <= channel.unilateralClose.sequence) {
    throw new Error(`Replacement state must have newer sequence: ${newerState.sequence} <= ${channel.unilateralClose.sequence}`);
  }
  const closePackageCheck = verifyClosePackage(channel, newerState);
  if (!closePackageCheck.valid) {
    throw new Error(`Cannot replace unilateral close state: ${closePackageCheck.errors.join('; ')}`);
  }
  return {
    ...channel,
    latestState: newerState,
    currentSequence: newerState.sequence,
    balances: newerState.balances,
    unilateralClose: {
      ...channel.unilateralClose,
      sequence: newerState.sequence,
      updateTxHex: newerState.closePackage!.update.txHex,
      settlementTxHex: newerState.closePackage!.settlement.txHex,
      status: 'update_broadcast',
    },
    status: 'disputing',
    updatedAt: Date.now(),
  };
}

export function markChannelClosing(
  channel: OmniaChannel,
  mode: 'mutual' | 'unilateral',
): OmniaChannel {
  return {
    ...channel,
    status: mode === 'mutual' ? 'closing_mutual' : 'closing_unilateral',
    updatedAt: Date.now(),
  };
}

export function markChannelClosed(channel: OmniaChannel): OmniaChannel {
  return {
    ...channel,
    status: 'closed',
    updatedAt: Date.now(),
    stateLog: [
      ...channel.stateLog,
      {
        sequence: channel.currentSequence,
        timestamp: Date.now(),
        balances: { ...channel.balances },
        htlcCount: 0,
        event: 'settle',
      },
    ],
  };
}
