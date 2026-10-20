import { hexToBytes } from '@totemsdk/core';
import type { WotsLeaseProvider, SigningIndices } from '@totemsdk/wots-lease';
import type {
  OmniaChannel,
  OmniaTxDraft,
  SignedChannelState,
  ChannelSigner,
  ChannelSignature,
  ProgramTransition,
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
import { addClosePackageSignature, buildUnsignedClosePackage, verifyClosePackage, verifyPartialClosePackage } from './close-package.js';
import { validateChannelStateWithKissvm } from './kissvm.js';
import { buildProgramUpdateTx, computeProgramUpdateDigestHex, resolveChannelProgram } from './program.js';
import { canonicalizeProgramTransition } from './transition.js';
import { verifyChannelSignature } from './wots.js';
import { makeSelfCustody, type SignRequest, type SignerPort } from './custody.js';

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
export interface UnsignedStateUpdate {
  channel: OmniaChannel;
  newSequence: number;
  newBalances: Record<string, bigint>;
  pendingHTLCs: OmniaChannel['pendingHTLCs'];
  stateVariables: OmniaTxDraft['stateVariables'];
  programTransition: ProgramTransition | undefined;
  transactionHex: string;
  updateDigest: Uint8Array;
  settlementDigest: Uint8Array;
  payloadHash: string;
  signerPartyId: string;
  unsignedClosePackage: ReturnType<typeof buildUnsignedClosePackage>;
}

export interface PreparedStateUpdate extends UnsignedStateUpdate {
  updateReservation: { reservationId: string; indices: SigningIndices };
  settlementReservation: { reservationId: string; indices: SigningIndices };
}

/**
 * Build a channel update without reserving a lease or signing.
 *
 * Used by coordinator/wallet flows: the wallet reserves and signs, then returns
 * the signatures and indices to `finalizeStateUpdateWithIndices`.
 */
export function buildStateUpdate(
  channel: OmniaChannel,
  update: { newSequence: number; newBalances: Record<string, bigint>; programTransition?: ProgramTransition },
  signer?: Pick<ChannelSigner, 'publicKeyDigest'>,
): UnsignedStateUpdate {
  const { newSequence, newBalances } = update;
  const signerDigest = signer?.publicKeyDigest ?? channel.localSigner?.publicKeyDigest;
  if (!signerDigest) throw new Error('No signer public key digest provided and channel.localSigner is not set');
  const signerParty = channel.parties.find(p => p.publicKeyDigest === signerDigest);
  if (!signerParty) throw new Error('Signer public key digest not found in channel parties');

  const pendingHTLCs = channel.pendingHTLCs.filter(h => h.status === 'pending');
  const programTransition = canonicalizeProgramTransition(update.programTransition);
  const draft = buildProgramUpdateTx(channel, newSequence, newBalances, channel.pendingHTLCs, programTransition);
  const updateDigest = computeOmniaTxDigest(draft);
  const payloadHash = computeProgramUpdateDigestHex(
    channel,
    newSequence,
    newBalances,
    channel.pendingHTLCs,
    programTransition,
  );

  const unsignedClosePackage = buildUnsignedClosePackage(channel, {
    sequence: newSequence,
    balances: newBalances,
    pendingHTLCs,
    stateVariables: draft.stateVariables,
    programTransition,
  });

  return {
    channel,
    newSequence,
    newBalances,
    pendingHTLCs,
    stateVariables: draft.stateVariables,
    programTransition,
    transactionHex: serializeTxDraft(draft),
    updateDigest,
    settlementDigest: hexToBytes(unsignedClosePackage.settlement.txDigest),
    payloadHash,
    signerPartyId: signerParty.partyId,
    unsignedClosePackage,
  };
}

/**
 * Build and reserve a channel update without signing it.
 *
 * The caller owns the reservations: sign `updateDigest` and `settlementDigest`
 * with the reserved indices, then call `finalizeStateUpdate` and commit the
 * leases. On any failure before returning, the reservations are burned.
 */
export async function prepareStateUpdate(
  channel: OmniaChannel,
  update: { newSequence: number; newBalances: Record<string, bigint>; programTransition?: ProgramTransition },
  leaseProvider: WotsLeaseProvider,
  signer?: ChannelSigner,
): Promise<PreparedStateUpdate> {
  const unsigned = buildStateUpdate(channel, update, signer);

  const updateReservation = await leaseProvider.reserveKeyUse({
    treeId: `omnia-channel-${channel.channelId}`,
    purpose: `channel-update-seq-${unsigned.newSequence}`,
    payloadHash: Buffer.from(unsigned.updateDigest).toString('hex'),
  });

  let settlementReservation: { reservationId: string; indices: SigningIndices } | undefined;
  try {
    settlementReservation = await leaseProvider.reserveKeyUse({
      treeId: `omnia-channel-${channel.channelId}`,
      purpose: `channel-settlement-seq-${unsigned.newSequence}`,
      payloadHash: unsigned.unsignedClosePackage.settlement.txDigest,
    });
    return { ...unsigned, updateReservation, settlementReservation };
  } catch (err) {
    await leaseProvider.burnReservation(updateReservation.reservationId, 'channel-update-prepare-failed').catch(() => {});
    if (settlementReservation) {
      await leaseProvider.burnReservation(settlementReservation.reservationId, 'channel-update-prepare-failed').catch(() => {});
    }
    throw err;
  }
}

/** Assemble a `SignedChannelState` from unsigned data and wallet-supplied indices. */
export function finalizeStateUpdateWithIndices(
  unsigned: UnsignedStateUpdate,
  updateSignature: ChannelSignature,
  updateIndices: SigningIndices,
  settlementSignature: ChannelSignature,
  settlementIndices: SigningIndices,
): Partial<SignedChannelState> {
  const closePackage = addClosePackageSignature(
    unsigned.unsignedClosePackage,
    unsigned.signerPartyId,
    updateSignature,
    updateIndices,
    settlementSignature,
    settlementIndices,
  );

  return {
    sequence: unsigned.newSequence,
    balances: unsigned.newBalances,
    pendingHTLCs: unsigned.pendingHTLCs,
    stateVariables: unsigned.stateVariables,
    transactionHex: unsigned.transactionHex,
    signatures: { [unsigned.signerPartyId]: updateSignature },
    signingIndices: { [unsigned.signerPartyId]: updateIndices },
    closePackage,
    programTransition: unsigned.programTransition,
  };
}

/** Assemble a `SignedChannelState` from a prepared update and its signatures. */
export function finalizeStateUpdate(
  prepared: PreparedStateUpdate,
  updateSignature: ChannelSignature,
  settlementSignature: ChannelSignature,
): Partial<SignedChannelState> {
  return finalizeStateUpdateWithIndices(
    prepared,
    updateSignature,
    prepared.updateReservation.indices,
    settlementSignature,
    prepared.settlementReservation.indices,
  );
}

/**
 * Signs a channel update state and returns the full partial `SignedChannelState`.
 *
 * This is the local-signer path: prepare -> sign both digests -> commit -> finalize.
 * For a wallet/coordinator flow use `prepareStateUpdate` + `finalizeStateUpdate`.
 */
export async function signState(
  channel: OmniaChannel,
  update: { newSequence: number; newBalances: Record<string, bigint>; programTransition?: ProgramTransition },
  leaseProvider: WotsLeaseProvider,
  signer?: ChannelSigner,
  signerPort?: SignerPort,
): Promise<Partial<SignedChannelState>> {
  const effectiveSigner = resolveSignerOrThrow(channel, signer);
  const signDigest = async (
    digest: Uint8Array,
    indices: SigningIndices,
    purpose: string,
  ): Promise<ChannelSignature> => {
    if (!signerPort) return effectiveSigner.sign(digest, indices);
    if (signerPort.publicKeyDigest !== effectiveSigner.publicKeyDigest) {
      throw new Error('signer port does not match the channel signer');
    }
    const request: SignRequest = {
      requestId: `channel-${channel.channelId}-${purpose}-${Date.now()}`,
      kind: 'chain',
      domain: 'channel',
      digest,
      context: { summary: purpose },
      signers: [signerPort.publicKeyDigest],
      signingIndices: indices,
      custody: makeSelfCustody(),
      expiresAt: Date.now() + 60_000,
    };
    return signerPort.sign(request);
  };

  const prepared = await prepareStateUpdate(channel, update, leaseProvider, signer);
  try {
    const updateSignature = await signDigest(
      prepared.updateDigest,
      prepared.updateReservation.indices,
      `channel-update-seq-${prepared.newSequence}`,
    );
    const settlementSignature = await signDigest(
      prepared.settlementDigest,
      prepared.settlementReservation.indices,
      `channel-settlement-seq-${prepared.newSequence}`,
    );
    await leaseProvider.commitKeyUse(
      prepared.updateReservation.reservationId,
      `channel-update-seq-${prepared.newSequence}`,
    );
    await leaseProvider.commitKeyUse(
      prepared.settlementReservation.reservationId,
      `channel-settlement-seq-${prepared.newSequence}`,
    );
    return finalizeStateUpdate(prepared, updateSignature, settlementSignature);
  } catch (err) {
    await leaseProvider.burnReservation(prepared.updateReservation.reservationId, 'channel-update-sign-failed').catch(() => {});
    await leaseProvider.burnReservation(prepared.settlementReservation.reservationId, 'channel-settlement-sign-failed').catch(() => {});
    throw err;
  }
}

/**
 * Verify a channel state signature using off-chain WOTS verification.
 *
  * Rebuilds the canonical Minima update transaction digest and verifies it
  * against the party's stored public key digest using `verifyChannelSignature`
  * (the wallet's hierarchical TreeKey scheme, RFC-037).
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
    const draft = buildProgramUpdateTx(channel, state.sequence, state.balances, state.pendingHTLCs, state.programTransition);
    const digest = computeOmniaTxDigest(draft);
    return verifyChannelSignature(sig, digest, publicKeyDigest);
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
  const programTransition = canonicalizeProgramTransition(state.programTransition);
  const programResult = program.validateTransition?.({
    channel,
    previousState: channel.latestState,
    nextState: state,
    transition: programTransition,
  });
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

/**
 * Validate a one-party state update before this node adds its co-signature.
 *
 * This performs the sequence, conservation, V2 commitment, program-hook,
 * partial close-package, and present-signature checks needed by the co-sign
 * path. It intentionally does not require every channel party to have signed.
 * After co-signing and merging, use `verifyState()` on the completed state.
 */
export async function verifyStateForCoSign(
  channel: OmniaChannel,
  state: SignedChannelState,
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
  const programTransition = canonicalizeProgramTransition(state.programTransition);
  const programResult = program.validateTransition?.({
    channel,
    previousState: channel.latestState,
    nextState: state,
    transition: programTransition,
  });
  if (programResult && !programResult.valid) {
    errors.push(`program validation failed: ${programResult.error ?? 'invalid transition'}`);
  }

  const partialClosePackageResult = verifyPartialClosePackage(channel, state);
  if (!partialClosePackageResult.valid) {
    errors.push(...partialClosePackageResult.errors);
  }

  const signedPartyIds = Object.keys(state.signatures ?? {});
  if (signedPartyIds.length === 0) {
    errors.push('missing state signature for co-sign');
  }
  for (const partyId of signedPartyIds) {
    const party = channel.parties.find(p => p.partyId === partyId);
    if (!party) {
      errors.push(`unknown signing party ${partyId}`);
      continue;
    }
    const indices = state.signingIndices[partyId];
    if (!indices) {
      errors.push(`missing signing indices for party ${partyId}`);
      continue;
    }
    if (!verifyStateSignature(channel, state, partyId, party.publicKeyDigest)) {
      errors.push(`invalid WOTS signature for party ${partyId}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
