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
import { serializeTxDraft, computeOmniaTxDigest, stateCommitmentV2Matches } from './transactions.js';
import { flatSigningIndex } from './capacity.js';
import { addClosePackageSignature, buildUnsignedClosePackage, verifyClosePackage } from './close-package.js';
import { validateChannelStateWithKissvm } from './kissvm.js';
import { buildProgramUpdateTx, resolveChannelProgram } from './program.js';

function resolveSignerOrThrow(channel: OmniaChannel, signer?: ChannelSigner): ChannelSigner {
  const effective = signer ?? channel.localSigner;
  if (!effective) throw new Error('No signer provided and channel.localSigner is not set');
  return effective;
}

/**
 * Core signing primitive used by both update and settlement paths.
 * Handles the full wots-lease reserve → sign → commit cycle for any OmniaTxDraft.
 *
 * The signed digest is the canonical Minima transaction digest, matching the
 * domain Minima validates in TxPoWChecker.checkSignatures().
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
  const digest = computeOmniaTxDigest(draft);

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
 * Signs the canonical Minima update transaction digest. The full off-chain state
 * is bound through StateCommitmentV2 embedded in STATE(102), making the digest
 * both L1-visible and KISSVM-visible.
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
  const pendingHTLCs = channel.pendingHTLCs.filter(h => h.status === 'pending');
  const draft = buildProgramUpdateTx(channel, newSequence, newBalances, channel.pendingHTLCs);

  const digest = computeOmniaTxDigest(draft);

  const reservation = await leaseProvider.reserveKeyUse({
    treeId: `omnia-channel-${channel.channelId}`,
    purpose: `channel-update-seq-${newSequence}`,
    payloadHash: Buffer.from(digest).toString('hex'),
  });

  const signature = await effectiveSigner.sign(digest, reservation.indices);
  await leaseProvider.commitKeyUse(reservation.reservationId, `channel-update-seq-${newSequence}`);

  const signerParty = channel.parties.find(p => p.publicKeyDigest === effectiveSigner.publicKeyDigest);
  if (!signerParty) throw new Error('Signer public key digest not found in channel parties');

  const unsignedClosePackage = buildUnsignedClosePackage(channel, {
    sequence: newSequence,
    balances: newBalances,
    pendingHTLCs,
    stateVariables: draft.stateVariables,
  });
  const settlementDigest = hexToBytes(unsignedClosePackage.settlement.txDigest);
  const settlementReservation = await leaseProvider.reserveKeyUse({
    treeId: `omnia-channel-${channel.channelId}`,
    purpose: `channel-settlement-seq-${newSequence}`,
    payloadHash: unsignedClosePackage.settlement.txDigest,
  });
  const settlementSignature = await effectiveSigner.sign(settlementDigest, settlementReservation.indices);
  await leaseProvider.commitKeyUse(settlementReservation.reservationId, `channel-settlement-seq-${newSequence}`);

  const closePackage = addClosePackageSignature(
    unsignedClosePackage,
    signerParty.partyId,
    signature,
    reservation.indices,
    settlementSignature,
    settlementReservation.indices,
  );

  const transactionHex = serializeTxDraft(draft);
  return {
    sequence: newSequence,
    balances: newBalances,
    pendingHTLCs,
    stateVariables: draft.stateVariables,
    transactionHex,
    signatures: { [signerParty.partyId]: signature },
    signingIndices: { [signerParty.partyId]: reservation.indices },
    closePackage,
  };
}

/**
 * Verify a channel state signature using off-chain WOTS verification.
 *
  * Rebuilds the canonical Minima update transaction digest and uses
  * `wotsVerifyDigest` to compare it against the party's stored public key digest.
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
    const draft = buildProgramUpdateTx(channel, state.sequence, state.balances, state.pendingHTLCs);
    const digest = computeOmniaTxDigest(draft);
    const pkDigestBytes = hexToBytes(publicKeyDigest);
    return wotsVerifyDigest(sig, digest, pkDigestBytes);
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

  if (!stateCommitmentV2Matches(channel, state, false)) {
    errors.push('state commitment v2 mismatch');
  }

  const program = resolveChannelProgram({ id: channel.programId, version: channel.programVersion });
  const programResult = program.validateTransition?.(channel, state);
  if (programResult && !programResult.valid) {
    errors.push(`program validation failed: ${programResult.error ?? 'invalid transition'}`);
  }

  const closePackageResult = verifyClosePackage(channel, state);
  if (!closePackageResult.valid) {
    errors.push(...closePackageResult.errors);
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
    const result = validateChannelStateWithKissvm(
      channel,
      state,
      typeof opts.kissvm === 'boolean' ? undefined : opts.kissvm,
    );
    if (!result.valid) errors.push(`kissvm pre-validation failed: ${result.error ?? 'unknown'}`);
  }

  return { valid: errors.length === 0, errors };
}
