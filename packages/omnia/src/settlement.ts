import { concatBytes } from '@totemsdk/core';
import { mineTxPoW, TX_POW_MIN_DIFFICULTY, serializeTxBody } from '@totemsdk/txpow';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { SigningIndices } from '@totemsdk/wots-lease';
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
import { buildSettlementTx, deserializeTxDraft, serializeTxDraft, omniaDraftToCanonicalMinimaBytes } from './transactions.js';
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
}

/**
 * Minimal witness encoding for eltoo settlement TX.
 * Packs the signing indices (addressIndex, l1, l2) followed by raw WOTS signature bytes.
 * In a full Minima integration this would be a Minima Witness with InputScriptInfo
 * and CoinProof, serialized via @totemsdk/core's Streamable. This encoding carries
 * the same data and is sufficient for the TxPoW body passed to serializeTxBody.
 */
function encodeSettlementWitness(signature: ChannelSignature, indices: SigningIndices): Uint8Array {
  const meta = new Uint8Array(8);
  const view = new DataView(meta.buffer);
  view.setUint32(0, indices.addressIndex, false);
  view.setUint16(4, indices.l1, false);
  view.setUint16(6, indices.l2, false);
  return concatBytes(meta, signature);
}

async function mineAndBroadcastDraft(
  txHex: string,
  chainProvider: ChainStateProvider,
  witnessBytes: Uint8Array,
): Promise<string | undefined> {
  const draftBytes = omniaDraftToCanonicalMinimaBytes(deserializeTxDraft(txHex));
  const txBody = serializeTxBody(draftBytes, witnessBytes);
  const mined = await mineTxPoW(txBody, TX_POW_MIN_DIFFICULTY);
  const fullTxPoW = concatBytes(concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01])), txBody);
  const broadcast = await chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));
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

  // Derive settlement addresses: use explicit override, then party.settlementAddress.
  const partyAddresses: Record<string, string> = {};
  for (const party of channel.parties) {
    const addr = opts?.partyAddresses?.[party.partyId] ?? party.settlementAddress;
    if (!addr) {
      throw new Error(
        `No settlement address for party ${party.partyId}. ` +
        `Set party.settlementAddress or pass opts.partyAddresses.`
      );
    }
    partyAddresses[party.partyId] = addr;
  }

  const state = channel.latestState ?? {
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

  const settlementDraft = buildSettlementTx(channel, state, partyAddresses);
  const settlementHex = serializeTxDraft(settlementDraft);

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
    const witnessBytes = serializeOmniaWitness({
      signatures: [encodeSettlementWitness(signature, indices)],
      coinProofs: opts.broadcastProofs.coinProofs,
      scriptProofs: opts.broadcastProofs.scriptProofs,
    });
    const txBody = serializeTxBody(draftBytes, witnessBytes);

    const mined = await mineTxPoW(txBody, TX_POW_MIN_DIFFICULTY);

    // Full TxPoW = TxHeader bytes + MiniByte(0x01=hasBody) + TxBody bytes
    const fullTxPoW = concatBytes(concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01])), txBody);
    await opts.chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));

    settlementPayload.txpowId = Buffer.from(mined.txpowId).toString('hex');
  }

  const partialState: Partial<SignedChannelState> = {
    sequence: state.sequence,
    balances: state.balances,
    pendingHTLCs: state.pendingHTLCs,
    stateVariables: settlementDraft.stateVariables,
    transactionHex: settlementHex,
    signatures: { [signerParty.partyId]: signature },
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
