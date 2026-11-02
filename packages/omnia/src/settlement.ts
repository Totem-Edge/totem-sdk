import { concatBytes } from '@totemsdk/core';
import { mineTxPoW, resolveTxPowTarget, serializeTxBody } from '@totemsdk/txpow';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { WotsLeaseProvider, SigningIndices } from '@totemsdk/wots-lease';
import type {
  OmniaChannel,
  OmniaTxDraft,
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
import { verifyChannelSignature } from './wots.js';
import { resolveSettlementAddresses } from './addresses.js';
import { channelContestDelay, coinCreatedBlock, confirmationsAt } from './chain-truth.js';
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
  /**
   * Wallet/coordinator flow: use an already-produced local settlement
   * signature instead of signing here. `localPartyId` and `localIndices`
   * identify the signer; no lease or signer is required.
   */
  localSignature?: ChannelSignature;
  localIndices?: SigningIndices;
  localPartyId?: string;
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
  return resolveSettlementAddresses(channel.parties, partyAddresses);
}

interface VerifiedSettlementDraft {
  state: SignedChannelState;
  draft: OmniaTxDraft;
  digest: Uint8Array;
  digestHex: string;
  txHex: string;
  partyAddresses: Record<string, string>;
}

/**
 * Build the settlement draft locally and verify any counterparty-supplied
 * claims against it.
 *
 * Settlement signing must never sign bytes that came off the wire. The draft is
 * always rebuilt from the channel's own state and agreed addresses, then any
 * supplied `settlementTxHex` / `digestHex` / `sequence` must match byte-for-byte
 * or the request is rejected. This is what stops a peer from obtaining a
 * co-signature over a settlement that pays the channel to itself.
 */
function buildVerifiedSettlementDraft(
  channel: OmniaChannel,
  claimed?: {
    sequence?: number;
    settlementTxHex?: string;
    digestHex?: string;
    partyAddresses?: Record<string, string>;
  },
): VerifiedSettlementDraft {
  const state = resolveSettlementState(channel);
  if (claimed?.sequence !== undefined && claimed.sequence !== state.sequence) {
    throw new Error(
      `Settlement sequence ${claimed.sequence} does not match the channel sequence ${state.sequence}`,
    );
  }
  const partyAddresses = resolveSettlementPartyAddresses(channel, claimed?.partyAddresses);
  const draft = buildSettlementTx(channel, state, partyAddresses);
  const txHex = serializeTxDraft(draft);
  const digest = computeOmniaTxDigest(draft);
  const digestHex = Buffer.from(digest).toString('hex');

  if (claimed?.settlementTxHex !== undefined && claimed.settlementTxHex !== txHex) {
    throw new Error('Settlement transaction does not match the channel state');
  }
  if (
    claimed?.digestHex !== undefined &&
    claimed.digestHex.replace(/^0x/i, '').toLowerCase() !== digestHex
  ) {
    throw new Error('Settlement digest does not match the channel state');
  }

  return { state, draft, digest, digestHex, txHex, partyAddresses };
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
  const { state, txHex, digestHex, partyAddresses } = buildVerifiedSettlementDraft(channel, {
    partyAddresses: opts?.partyAddresses,
  });
  return {
    channelId: channel.channelId,
    sequence: state.sequence,
    settlementTxHex: txHex,
    digestHex: '0x' + digestHex,
    partyAddresses,
  };
}

/**
 * Co-sign a settlement signing request. Used by the counterparty to provide its
 * half of the eltoo `MULTISIG(2 …)` settlement witness.
 *
 * The request is verified against the channel before signing: same channel, same
 * sequence, agreed party addresses, and a draft that matches the locally built
 * settlement byte-for-byte. Only the local draft is ever signed.
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
  if (request.channelId !== channel.channelId) {
    throw new Error('Settlement request channelId does not match the channel');
  }

  const { state, draft } = buildVerifiedSettlementDraft(channel, {
    sequence: request.sequence,
    settlementTxHex: request.settlementTxHex,
    digestHex: request.digestHex,
    partyAddresses: request.partyAddresses,
  });

  const { signature, indices } = await signTxDraft(
    channel,
    draft,
    `settlement-sign-seq-${state.sequence}`,
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
  leaseProvider: WotsLeaseProvider | undefined,
  opts?: ProposeSettlementOptions,
): Promise<{ settlementPayload: SettlementPayload; partialState: Partial<SignedChannelState> }> {
  if (!['active', 'closing_mutual'].includes(channel.status)) {
    throw new ChannelStatusError(['active', 'closing_mutual'], channel.status);
  }

  const effectiveSigner = opts?.signer ?? channel.localSigner;
  const signerParty = opts?.localPartyId
    ? channel.parties.find(p => p.partyId === opts.localPartyId)
    : channel.parties.find(p => p.publicKeyDigest === effectiveSigner?.publicKeyDigest);
  if (!signerParty) throw new Error('Signer is not a channel participant');
  if (!opts?.localSignature && !effectiveSigner) {
    throw new Error('No signer provided and channel.localSigner is not set');
  }

  const {
    state,
    draft: settlementDraft,
    txHex: settlementHex,
    digest,
  } = buildVerifiedSettlementDraft(channel, {
    settlementTxHex: opts?.settlementTxHex,
    partyAddresses: opts?.partyAddresses,
  });

  // A signature we did not produce ourselves is untrusted input. Verify it
  // against the locally built settlement digest before it enters the witness.
  for (const counter of opts?.counterpartySignatures ?? []) {
    const party = channel.parties.find(p => p.partyId === counter.partyId);
    if (!party) {
      throw new Error(
        `Counterparty settlement signature party '${counter.partyId}' is not a channel participant`,
      );
    }
    if (!verifyChannelSignature(counter.signature, digest, party.publicKeyDigest)) {
      throw new Error(`Invalid counterparty settlement signature for party ${counter.partyId}`);
    }
  }

  // signTxDraft signs the settlement TX (STATE(100)=TRUE), not the update TX.
  let signature: ChannelSignature;
  let indices: SigningIndices | undefined;
  if (opts?.localSignature) {
    if (!verifyChannelSignature(opts.localSignature, digest, signerParty.publicKeyDigest)) {
      throw new Error(`Provided settlement signature is not valid for party ${signerParty.partyId}`);
    }
    signature = opts.localSignature;
    indices = opts.localIndices;
  } else {
    if (!effectiveSigner) throw new Error('No signer provided and channel.localSigner is not set');
    if (!leaseProvider) throw new Error('No lease provider provided for settlement signing');
    ({ signature, indices } = await signTxDraft(
      channel,
      settlementDraft,
      `settlement-seq-${state.sequence}`,
      leaseProvider,
      effectiveSigner,
    ));
  }

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
    // MULTISIG verifies in key order: order the witness by the channel parties.
    const signatureByParty: Record<string, Uint8Array> = { [signerParty.partyId]: signature };
    for (const counter of opts.counterpartySignatures ?? []) {
      signatureByParty[counter.partyId] = counter.signature;
    }
    const signatures = channel.parties
      .map((party) => signatureByParty[party.partyId])
      .filter((sig): sig is Uint8Array => sig instanceof Uint8Array);
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
    signingIndices: indices ? { [signerParty.partyId]: indices } : {},
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

  const delay = channelContestDelay(channel);

  const tip = await chainProvider.getTip();
  const updateTxpowId = await mineAndBroadcastDraft(
    closePackage.update.txHex,
    chainProvider,
    serializeOmniaWitness({
      signatures: closePackageSignatureBytes(latest, 'update', channel.parties.map(p => p.partyId)),
      coinProofs: broadcastProofs.coinProofs,
      scriptProofs: broadcastProofs.scriptProofs,
    }),
  );
  const contestDeadlineBlock = tip.block + delay;
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

/**
 * Record the on-chain output of the broadcast unilateral update.
 *
 * The update transaction is built with the eltoo placeholder coin id, so its
 * output coin id cannot be derived locally — only the chain knows it. Until this
 * is recorded, `finalizeUnilateralClose` refuses to run: finalising on an
 * unfunded assumption is exactly how a premature settlement would happen.
 *
 * Recording also restarts the contest clock from the coin's actual inclusion
 * height, rather than from the pre-broadcast tip.
 */
export async function recordUnilateralUpdateCoin(
  channel: OmniaChannel,
  coinId: string,
  chainProvider?: ChainStateProvider,
  minConfirmations: number = 1,
): Promise<OmniaChannel> {
  const closeState = channel.unilateralClose;
  if (!closeState) throw new Error('Cannot record the update coin: no unilateral close in progress');
  if (!channel.fundingAddress) throw new Error('Channel fundingAddress is required to record the update coin');

  if (!chainProvider) {
    throw new Error('A chain provider is required to record the update coin');
  }
  const coin = await chainProvider.getCoin(coinId);
  if (!coin) throw new Error(`Update output coin ${coinId} not found on chain`);
  if (coin.spent) throw new Error(`Update output coin ${coinId} is already spent`);
  if (coin.address !== channel.fundingAddress) {
    throw new Error(`Update output address ${coin.address} is not the channel script address ${channel.fundingAddress}`);
  }
  if (minConfirmations > 0) {
    const tip = await chainProvider.getTip();
    const confirmations = confirmationsAt(coin, tip.block);
    if (confirmations === null || confirmations < minConfirmations) {
      throw new Error(
        `Update output coin ${coinId} has ${confirmations ?? 'unknown'} confirmations; ${minConfirmations} required`,
      );
    }
  }
  const includedAt = coinCreatedBlock(coin);
  if (includedAt === null) {
    throw new Error(`Cannot determine the inclusion height of update output coin ${coinId}`);
  }

  return {
    ...channel,
    unilateralClose: {
      ...closeState,
      updateCoinId: coinId,
      contestStartBlock: includedAt,
      contestDeadlineBlock: includedAt + channelContestDelay(channel),
    },
    updatedAt: Date.now(),
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

  // The settlement bytes must come from the verified close package of the state
  // being closed — never from the stored copy, which can be stale or mixed with
  // signatures from a different state.
  const latest = channel.latestState;
  if (!latest) throw new Error('Cannot finalize unilateral close: no signed state available');
  if (latest.sequence !== closeState.sequence) {
    throw new Error(
      `Unilateral close state is stale: latest signed state is ${latest.sequence}, close package is ${closeState.sequence}. Replace it before finalizing.`,
    );
  }
  const closePackageCheck = verifyClosePackage(channel, latest);
  if (!closePackageCheck.valid) {
    throw new Error(`Cannot finalize unilateral close: ${closePackageCheck.errors.join('; ')}`);
  }
  const closePackage = latest.closePackage!;

  const delay = channelContestDelay(channel);
  const tip = await chainProvider.getTip();
  if (tip.block < closeState.contestDeadlineBlock) {
    throw new Error(`Contest delay not elapsed: current block ${tip.block}, deadline ${closeState.contestDeadlineBlock}`);
  }
  if (!closeState.updateCoinId) {
    throw new Error(
      'Contest delay not elapsed: the unilateral update output coin has not been recorded. ' +
      'Call recordUnilateralUpdateCoin() after the update is mined.',
    );
  }
  {
    const updateCoin = await chainProvider.getCoin(closeState.updateCoinId);
    if (!updateCoin) {
      throw new Error('Contest delay not elapsed: the unilateral update output is not on chain');
    }
    const includedAt = coinCreatedBlock(updateCoin);
    if (includedAt === null) {
      throw new Error('Contest delay not elapsed: cannot determine the update inclusion height');
    }
    if (tip.block - includedAt < delay) {
      throw new Error(
        `Contest delay not elapsed: update included at ${includedAt}, current block ${tip.block}, delay ${delay}`,
      );
    }
  }

  assertBroadcastProofs(broadcastProofs);

  const settlementTxpowId = await mineAndBroadcastDraft(
    closePackage.settlement.txHex,
    chainProvider,
    serializeOmniaWitness({
      signatures: closePackageSignatureBytes(latest, 'settlement', channel.parties.map(p => p.partyId)),
      coinProofs: broadcastProofs.coinProofs,
      scriptProofs: broadcastProofs.scriptProofs,
    }),
  );
  const htlcOutputs = latest.pendingHTLCs
    .filter(h => h.status === 'pending')
    .map(h => ({ htlcId: h.htlcId, amount: h.amount, htlcTxHex: '' }));
  const settlementPayload: SettlementPayload = {
    channelId: channel.channelId,
    sequence: latest.sequence,
    settlementTxHex: closePackage.settlement.txHex,
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

/**
 * Replace the in-flight unilateral close with a newer signed state and rebroadcast
 * its update transaction.
 *
 * Eltoo lets either party outrun a stale close with a newer co-signed update. The
 * replacement must be broadcast (and its contest window restarted); only updating
 * local metadata would leave the old update on chain and the old deadline in place.
 */
export async function replaceUnilateralCloseState(
  channel: OmniaChannel,
  newerState: SignedChannelState,
  chainProvider: ChainStateProvider,
  broadcastProofs?: OmniaWitnessProofs,
): Promise<OmniaChannel> {
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
  assertBroadcastProofs(broadcastProofs);

  const closePackage = newerState.closePackage!;
  const tip = await chainProvider.getTip();
  const updateTxpowId = await mineAndBroadcastDraft(
    closePackage.update.txHex,
    chainProvider,
    serializeOmniaWitness({
      signatures: closePackageSignatureBytes(newerState, 'update', channel.parties.map(p => p.partyId)),
      coinProofs: broadcastProofs.coinProofs,
      scriptProofs: broadcastProofs.scriptProofs,
    }),
  );
  const contestDeadlineBlock = tip.block + channelContestDelay(channel);

  return {
    ...channel,
    latestState: newerState,
    currentSequence: newerState.sequence,
    balances: newerState.balances,
    unilateralClose: {
      channelId: channel.unilateralClose.channelId,
      sequence: newerState.sequence,
      updateTxHex: closePackage.update.txHex,
      settlementTxHex: closePackage.settlement.txHex,
      contestStartBlock: tip.block,
      contestDeadlineBlock,
      status: 'update_broadcast',
      updateTxpowId,
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
