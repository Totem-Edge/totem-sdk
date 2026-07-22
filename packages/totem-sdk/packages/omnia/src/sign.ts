import { wotsVerifyDigest, hexToBytes } from '@totemsdk/core';
import type { WotsLeaseProvider, SigningIndices } from '@totemsdk/wots-lease';
import type {
  OmniaChannel,
  OmniaTxDraft,
  SignedChannelState,
  ChannelSigner,
  ChannelSignature,
  VerifyStateOptions,
} from './types.js';
import {
  DoubleSignError,
  BalanceConservationError,
  SequenceError,
  SigningIndexMonotonicityError,
} from './errors.js';
import { buildUpdateTx, serializeTxDraft, computeTxDraftDigest, computeStateCommitment } from './transactions.js';
import { flatSigningIndex } from './capacity.js';

function resolveSignerOrThrow(channel: OmniaChannel, signer?: ChannelSigner): ChannelSigner {
  const effective = signer ?? channel.localSigner;
  if (!effective) throw new Error('No signer provided and channel.localSigner is not set');
  return effective;
}

/**
 * Core signing primitive used by both update and settlement paths.
 * Handles the full wots-lease reserve → sign → commit cycle for any OmniaTxDraft.
 *
 * The signed digest is the TX draft digest (suitable for settlement/dispute TXs
 * where the on-chain TX fully encodes the intent). For channel update TXs, use
 * `signState` which signs the full state commitment instead (see NOTE below).
 *
 * @param channel      - The channel context (used for treeId and localSigner fallback).
 * @param draft        - Pre-built TX draft to sign (update TX or settlement TX).
 * @param purpose      - Human-readable purpose label stored with the lease reservation.
 * @param leaseProvider - WOTS lease provider for key slot reservation/commit.
 * @param signer       - Optional explicit signer; falls back to channel.localSigner.
 */
export async function signTxDraft(
  channel: OmniaChannel,
  draft: OmniaTxDraft,
  purpose: string,
  leaseProvider: WotsLeaseProvider,
  signer?: ChannelSigner,
): Promise<{ signature: ChannelSignature; indices: SigningIndices; transactionHex: string }> {
  const effectiveSigner = resolveSignerOrThrow(channel, signer);
  // Settlement/dispute TXs encode their full intent on-chain, so the TX draft
  // digest is a sufficient commitment. Update TXs must use signState instead.
  const digest = computeTxDraftDigest(draft);

  const reservation = await leaseProvider.reserveKeyUse({
    treeId: `omnia-channel-${channel.channelId}`,
    purpose,
    payloadHash: Buffer.from(digest).toString('hex'),
  });

  const signature = await effectiveSigner.sign(digest, reservation.indices);
  await leaseProvider.commitKeyUse(reservation.reservationId, purpose);

  const transactionHex = serializeTxDraft(draft);
  return { signature, indices: reservation.indices, transactionHex };
}

/**
 * Signs a channel update state and returns the full partial `SignedChannelState`.
 *
 * Signs the FULL state commitment — SHA3-256( sequence ‖ sorted-balances ‖ pending-HTLCs ) —
 * NOT just the on-chain TX draft digest. This is critical because `buildUpdateTx` only
 * encodes the UTXO total on-chain (eltoo design); the per-party balance split is purely
 * off-chain. If the signature covered only the TX draft, an adversary could tamper with
 * balance/HTLC fields in a `SignedChannelState` while the WOTS signature remained valid,
 * breaking dispute evidence integrity.
 *
 * The same `computeStateCommitment` is used by `verifyStateSignature` and the module-level
 * watermark check — single source of truth for what is signed.
 *
 * Executes the full reserve → sign → commit WOTS lease cycle and returns a
 * `Partial<SignedChannelState>` with `signatures` and `signingIndices` keyed by the
 * signer's `partyId`, ready to be forwarded to the counterparty for co-signing.
 *
 * @param channel       - The channel context (used for treeId, localSigner fallback, pendingHTLCs).
 * @param update        - New sequence number and balance split for this state.
 * @param leaseProvider - WOTS lease provider.
 * @param signer        - Optional explicit signer; falls back to channel.localSigner.
 */
export async function signState(
  channel: OmniaChannel,
  update: { newSequence: number; newBalances: Record<string, bigint> },
  leaseProvider: WotsLeaseProvider,
  signer?: ChannelSigner,
): Promise<Partial<SignedChannelState>> {
  const { newSequence, newBalances } = update;
  const effectiveSigner = resolveSignerOrThrow(channel, signer);
  const draft = buildUpdateTx(channel, newSequence, newBalances, channel.pendingHTLCs);

  // Commitment covers the full off-chain state: sequence + balance split + pending HTLCs.
  const commitment = computeStateCommitment(newSequence, newBalances, channel.pendingHTLCs);

  const reservation = await leaseProvider.reserveKeyUse({
    treeId: `omnia-channel-${channel.channelId}`,
    purpose: `channel-update-seq-${newSequence}`,
    payloadHash: Buffer.from(commitment).toString('hex'),
  });

  const signature = await effectiveSigner.sign(commitment, reservation.indices);
  await leaseProvider.commitKeyUse(reservation.reservationId, `channel-update-seq-${newSequence}`);

  const signerParty = channel.parties.find(p => p.publicKeyDigest === effectiveSigner.publicKeyDigest);
  if (!signerParty) throw new Error('Signer public key digest not found in channel parties');

  const transactionHex = serializeTxDraft(draft);
  return {
    sequence: newSequence,
    balances: newBalances,
    pendingHTLCs: channel.pendingHTLCs.filter(h => h.status === 'pending'),
    stateVariables: [
      { port: 100, value: false, type: 'bool' as const },
      { port: 101, value: BigInt(newSequence), type: 'number' as const },
    ],
    transactionHex,
    signatures: { [signerParty.partyId]: signature },
    signingIndices: { [signerParty.partyId]: reservation.indices },
  };
}

/**
 * Verify a channel state signature using off-chain WOTS verification.
 *
 * Recomputes `computeStateCommitment(state.sequence, state.balances, state.pendingHTLCs)` —
 * the same digest signed by `signState` — and uses `wotsVerifyDigest` to reconstruct the
 * WOTS public key from the signature and compare its SHA3-256 hash against the party's
 * stored `publicKeyDigest`.
 *
 * Because the commitment covers the full off-chain state (sequence + balance split +
 * pending HTLCs), any tampering with these fields after signing will cause verification
 * to fail, preserving the integrity of dispute evidence.
 */
export function verifyStateSignature(
  channel: OmniaChannel,
  state: SignedChannelState,
  partyId: string,
  publicKeyDigest: string,
): boolean {
  const party = channel.parties.find(p => p.partyId === partyId);
  if (!party) return false;

  const sig = state.signatures[partyId];
  if (!sig || !(sig instanceof Uint8Array)) return false;

  try {
    // Must use the same commitment as signState — NOT the TX draft digest.
    const commitment = computeStateCommitment(state.sequence, state.balances, state.pendingHTLCs);
    const pkDigestBytes = hexToBytes(publicKeyDigest);
    return wotsVerifyDigest(sig, commitment, pkDigestBytes);
  } catch {
    return false;
  }
}

/**
 * Validates a proposed state transition without requiring signing indices.
 * Checks: sequence monotonicity, balance conservation.
 * Double-sign detection is handled at the updateState level using pendingProposal.
 */
export function validateStateTransition(
  channel: OmniaChannel,
  newSequence: number,
  newBalances: Record<string, bigint>,
  pendingHTLCDelta: bigint,
): void {
  if (newSequence <= channel.currentSequence) {
    throw new SequenceError(channel.currentSequence, newSequence);
  }

  const totalValue = channel.totalValue;
  const htlcTotal = channel.pendingHTLCs
    .filter(h => h.status === 'pending')
    .reduce((a, h) => a + h.amount, 0n) + pendingHTLCDelta;
  const balanceSum = Object.values(newBalances).reduce((a, b) => a + b, 0n);
  if (balanceSum + htlcTotal !== totalValue) {
    throw new BalanceConservationError(totalValue, balanceSum + htlcTotal);
  }
}

export async function verifyState(
  channel: OmniaChannel,
  state: SignedChannelState,
  opts?: VerifyStateOptions,
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (state.sequence <= channel.currentSequence) {
    errors.push(`sequence ${state.sequence} not > current ${channel.currentSequence}`);
  }

  const balanceSum = Object.values(state.balances).reduce((a, b) => a + b, 0n);
  const htlcSum = state.pendingHTLCs
    .filter(h => h.status === 'pending')
    .reduce((a, h) => a + h.amount, 0n);
  if (balanceSum + htlcSum !== channel.totalValue) {
    errors.push(`balance conservation: ${balanceSum + htlcSum} !== ${channel.totalValue}`);
  }

  for (const party of channel.parties) {
    const sig = state.signatures[party.partyId];
    const indices = state.signingIndices[party.partyId];
    if (!sig || !indices) {
      errors.push(`missing signature/indices for party ${party.partyId}`);
      continue;
    }

    const valid = verifyStateSignature(channel, state, party.partyId, party.publicKeyDigest);
    if (!valid) {
      errors.push(`invalid WOTS signature for party ${party.partyId}`);
    }

    if (channel.latestState) {
      const prevIndices = channel.latestState.signingIndices[party.partyId];
      if (prevIndices) {
        const prevFlat = flatSigningIndex(prevIndices.l1, prevIndices.l2);
        const newFlat = flatSigningIndex(indices.l1, indices.l2);
        if (newFlat <= prevFlat) {
          errors.push(`signing index not monotone for party ${party.partyId}: ${newFlat} <= ${prevFlat}`);
        }
      }
    }
  }

  if (opts?.kissvm) {
    const stateVars = state.stateVariables;
    const result = await opts.kissvm.evaluate(channel.fundingScript, stateVars);
    if (!result.result) {
      errors.push(`kissvm pre-validation failed: ${result.error ?? 'unknown'}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
