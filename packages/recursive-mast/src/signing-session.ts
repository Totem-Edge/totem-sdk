/**
 * Signing Session — state machine for multi-party policy transaction coordination.
 *
 * A multi-party policy transaction is not just a request and response.
 * It is a state machine that progresses through:
 *   draft → resolving → awaiting-evidence → awaiting-signatures → ready → submitted → confirmed
 *
 * The coordinator is not trusted — it merely assembles data. Every signer
 * independently verifies the transaction before signing.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyAction } from './policy-manifest.js';
import type { PolicySigningRequest, PolicySigningResponse, SignedEvidence, ScriptDisclosure, PolicyPathDescriptor } from './policy-signing.js';

export type SigningSessionStatus =
  | 'draft'
  | 'resolving'
  | 'awaiting-evidence'
  | 'awaiting-signatures'
  | 'ready'
  | 'expired'
  | 'rejected'
  | 'cancelled'
  | 'submitted'
  | 'confirmed';

export interface RequiredRoleState {
  role: string;
  required: boolean;
  signed: boolean;
  signerIdentityId?: string;
  signature?: string;
  signedAt?: number;
}

export interface EvidenceState {
  evidenceId: string;
  type: string;
  collected: boolean;
  data?: string;
  signerPkd?: string;
}

export interface SigningSession {
  sessionId: string;
  requestId: string;

  policyId: string;
  policyVersion: number;
  policyEpoch: number;

  action: string;
  transactionDigest: string;

  requiredRoles: RequiredRoleState[];
  evidence: EvidenceState[];
  responses: PolicySigningResponse[];

  expiresAt: number;
  status: SigningSessionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SigningSessionConfig {
  policyId: string;
  policyVersion: number;
  policyEpoch: number;
  action: string;
  transactionDigest: string;
  requiredRoles: string[];
  optionalRoles?: string[];
  requiredEvidence: { evidenceId: string; type: string }[];
  expirySeconds?: number;
}

/**
 * Create a new signing session.
 */
export function createSigningSession(config: SigningSessionConfig): SigningSession {
  const now = Date.now();
  const sessionId = `sess-${bytesToHex(sha3_256(new TextEncoder().encode(`${now}-${config.policyId}-${config.action}`))).slice(0, 16)}`;

  const requiredRoles: RequiredRoleState[] = [
    ...config.requiredRoles.map(r => ({ role: r, required: true, signed: false })),
    ...(config.optionalRoles ?? []).map(r => ({ role: r, required: false, signed: false })),
  ];

  const evidence: EvidenceState[] = config.requiredEvidence.map(e => ({
    evidenceId: e.evidenceId,
    type: e.type,
    collected: false,
  }));

  return {
    sessionId,
    requestId: `req-${sessionId}`,
    policyId: config.policyId,
    policyVersion: config.policyVersion,
    policyEpoch: config.policyEpoch,
    action: config.action,
    transactionDigest: config.transactionDigest,
    requiredRoles,
    evidence,
    responses: [],
    expiresAt: now + (config.expirySeconds ?? 300) * 1000,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Transition the session to the next appropriate status.
 */
export function advanceSession(session: SigningSession): SigningSession {
  if (Date.now() > session.expiresAt) {
    return { ...session, status: 'expired', updatedAt: Date.now() };
  }

  const allEvidenceCollected = session.evidence.every(e => e.collected);
  const allRequiredSigned = session.requiredRoles
    .filter(r => r.required)
    .every(r => r.signed);
  const anyRejected = session.responses.some(r => r.status === 'rejected');

  if (anyRejected) {
    return { ...session, status: 'rejected', updatedAt: Date.now() };
  }

  if (!allEvidenceCollected) {
    return { ...session, status: 'awaiting-evidence', updatedAt: Date.now() };
  }

  if (!allRequiredSigned) {
    return { ...session, status: 'awaiting-signatures', updatedAt: Date.now() };
  }

  return { ...session, status: 'ready', updatedAt: Date.now() };
}

/**
 * Accept a signing response into the session.
 */
export function acceptResponse(
  session: SigningSession,
  response: PolicySigningResponse,
): SigningSession {
  const updated = { ...session, responses: [...session.responses, response] };

  if (response.status === 'approved' && response.signature) {
    updated.requiredRoles = updated.requiredRoles.map(r =>
      r.role === response.role
        ? { ...r, signed: true, signerIdentityId: response.signerIdentityId, signature: response.signature, signedAt: response.signedAt }
        : r,
    );
  }

  return advanceSession(updated);
}

/**
 * Record evidence collection.
 */
export function recordEvidence(
  session: SigningSession,
  evidence: SignedEvidence,
): SigningSession {
  const updated = { ...session };
  updated.evidence = updated.evidence.map(e =>
    e.evidenceId === evidence.evidenceId
      ? { ...e, collected: true, data: evidence.data, signerPkd: evidence.signerPkd }
      : e,
  );
  return advanceSession(updated);
}

/**
 * Mark the session as submitted.
 */
export function submitSession(session: SigningSession): SigningSession {
  if (session.status !== 'ready') {
    throw new Error(`Cannot submit session with status '${session.status}' — must be 'ready'`);
  }
  return { ...session, status: 'submitted', updatedAt: Date.now() };
}

/**
 * Mark the session as confirmed (transaction mined).
 * Requires txpowId and confirmed block — a caller cannot declare
 * a transaction confirmed without evidence. Session must be in
 * 'submitted' status.
 */
export function confirmSession(
  session: SigningSession,
  confirmation: {
    txpowId: string;
    inclusionProof?: string;
    confirmedBlock: number;
  },
): SigningSession {
  if (session.status !== 'submitted') {
    throw new Error(`Cannot confirm session with status '${session.status}' — must be 'submitted'`);
  }
  if (!confirmation.txpowId || confirmation.txpowId.length === 0) {
    throw new Error('Cannot confirm session without a valid txpowId');
  }
  if (confirmation.confirmedBlock < 0) {
    throw new Error('Cannot confirm session with negative block height');
  }
  return {
    ...session,
    status: 'confirmed',
    updatedAt: Date.now(),
  };
}

/**
 * Cancel the session.
 */
export function cancelSession(session: SigningSession, reason?: string): SigningSession {
  return { ...session, status: 'cancelled', updatedAt: Date.now() };
}

/**
 * Get the session's readiness summary.
 */
export function sessionSummary(session: SigningSession): {
  status: SigningSessionStatus;
  signedCount: number;
  requiredCount: number;
  evidenceCollected: number;
  evidenceRequired: number;
  pendingRoles: string[];
  remainingEvidence: string[];
} {
  return {
    status: session.status,
    signedCount: session.requiredRoles.filter(r => r.signed).length,
    requiredCount: session.requiredRoles.filter(r => r.required).length,
    evidenceCollected: session.evidence.filter(e => e.collected).length,
    evidenceRequired: session.evidence.length,
    pendingRoles: session.requiredRoles.filter(r => r.required && !r.signed).map(r => r.role),
    remainingEvidence: session.evidence.filter(e => !e.collected).map(e => e.evidenceId),
  };
}