/**
 * purchasing/terms.ts — Canonical terms hashing and proposal digest.
 *
 * Deterministic canonical JSON (sorted keys) is used so that:
 *   - a counterproposal with identical terms to its parent is detectable
 *     (same termsHash → rejected)
 *   - the proposal digest binds every security-relevant field
 *   - the Machine Work Admission action commitment can bind the proposal
 */

import { sha3_256 } from '@totemsdk/core';
import { canonicalJson, toHex } from '../canonical.js';
import type { TradeProposal, TradeTerms } from './types.js';

/** Canonical SHA3-256 hex hash of trade terms. */
export function termsHash(terms: TradeTerms): string {
  const canonical = canonicalJson(terms);
  return toHex(sha3_256(new TextEncoder().encode(canonical)));
}

/**
 * Canonical digest of a TradeProposal (excluding the signature and the
 * signer public key, which are not part of the signed content).
 *
 * Binds: version, proposalId, negotiationId, parentProposalId, round,
 * manifestId, proposer, recipient, terms, createdAt, expiresAt.
 */
export function proposalDigest(
  proposal: Omit<TradeProposal, 'signature' | 'signerPublicKey'>,
): string {
  const canonical = canonicalJson({
    version: proposal.version,
    proposalId: proposal.proposalId,
    negotiationId: proposal.negotiationId,
    parentProposalId: proposal.parentProposalId,
    round: proposal.round,
    manifestId: proposal.manifestId,
    proposer: proposal.proposer,
    recipient: proposal.recipient,
    terms: proposal.terms,
    createdAt: proposal.createdAt,
    expiresAt: proposal.expiresAt,
  });
  return toHex(sha3_256(new TextEncoder().encode(canonical)));
}

/**
 * Canonical digest of a WorkRequired message (excluding signature).
 */
export function workRequiredDigest(
  msg: Omit<WorkRequiredLike, 'signature'>,
): string {
  const canonical = canonicalJson({
    version: msg.version,
    negotiationId: msg.negotiationId,
    proposalId: msg.proposalId,
    sender: msg.sender,
    recipient: msg.recipient,
    challenge: msg.challenge,
    reason: msg.reason,
  });
  return toHex(sha3_256(new TextEncoder().encode(canonical)));
}

/** Structural subset of WorkRequired used for digest computation. */
interface WorkRequiredLike {
  version: number;
  negotiationId: string;
  proposalId?: string;
  sender: string;
  recipient: string;
  challenge: unknown;
  reason: string;
}

/**
 * Canonical digest of a ProposalAcceptance (excluding signature).
 */
export function acceptanceDigest(
  msg: Omit<AcceptanceLike, 'signature'>,
): string {
  const canonical = canonicalJson({
    version: msg.version,
    negotiationId: msg.negotiationId,
    proposalId: msg.proposalId,
    acceptor: msg.acceptor,
    recipient: msg.recipient,
    acceptedAt: msg.acceptedAt,
  });
  return toHex(sha3_256(new TextEncoder().encode(canonical)));
}

interface AcceptanceLike {
  version: number;
  negotiationId: string;
  proposalId: string;
  acceptor: string;
  recipient: string;
  acceptedAt: number;
}

/**
 * Canonical digest of a ProposalRejection (excluding signature).
 */
export function rejectionDigest(
  msg: Omit<RejectionLike, 'signature'>,
): string {
  const canonical = canonicalJson({
    version: msg.version,
    negotiationId: msg.negotiationId,
    proposalId: msg.proposalId,
    rejector: msg.rejector,
    recipient: msg.recipient,
    reason: msg.reason,
    rejectedAt: msg.rejectedAt,
  });
  return toHex(sha3_256(new TextEncoder().encode(canonical)));
}

interface RejectionLike {
  version: number;
  negotiationId: string;
  proposalId: string;
  rejector: string;
  recipient: string;
  reason?: string;
  rejectedAt: number;
}

/**
 * Canonical digest of a NegotiationCancellation (excluding signature).
 */
export function cancellationDigest(
  msg: Omit<CancellationLike, 'signature'>,
): string {
  const canonical = canonicalJson({
    version: msg.version,
    negotiationId: msg.negotiationId,
    sender: msg.sender,
    recipient: msg.recipient,
    reason: msg.reason,
    cancelledAt: msg.cancelledAt,
  });
  return toHex(sha3_256(new TextEncoder().encode(canonical)));
}

interface CancellationLike {
  version: number;
  negotiationId: string;
  sender: string;
  recipient: string;
  reason?: string;
  cancelledAt: number;
}
