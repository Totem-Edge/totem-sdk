/**
 * Local signer port (RFC-058 P1).
 *
 * Adapts the host's unified TreeKey signer + WOTS lease to the SDK `SignerPort`
 * contract. A hosted deployment supplies its own `SignerPort` (KMS/HSM/MPC +
 * policy) instead; the host code is agnostic.
 */

import { bytesToHex } from '@totemsdk/core';
import {
  assertCustodyAllowsSigning,
  assertSignRequest,
  custodyDisclosureId,
  signRequestPayload,
  type CustodyAcknowledgement,
  type CustodyMode,
  type SignDomain,
  type SignRequest,
  type SignerPort,
} from '@totemsdk/omnia';
import type { HostSigning } from './signing.js';

export function createLocalSignerPort(signing: HostSigning): SignerPort {
  return {
    publicKeyDigest: signing.publicKeyDigest,
    async sign(request: SignRequest): Promise<Uint8Array> {
      assertSignRequest(request);
      if (!request.signers.includes(signing.publicKeyDigest)) {
        throw new Error(`local signer ${signing.publicKeyDigest} is not a required signer for ${request.requestId}`);
      }

      const payload = signRequestPayload(request);
      if (request.signingIndices) {
        // Caller owns the lease (channel/factory tx signing); sign the exact leaf.
        return signing.signer.sign(payload, request.signingIndices);
      }
      const reservation = await signing.leaseProvider.reserveKeyUse({
        treeId: 'omnia-sign-request',
        purpose: `sign-request:${request.domain}`,
        payloadHash: bytesToHex(payload),
      });
      try {
        const signature = await signing.signer.sign(payload, reservation.indices);
        await signing.leaseProvider.commitKeyUse(
          reservation.reservationId,
          `sign-request:${request.domain}`,
        );
        return signature;
      } catch (err) {
        await signing.leaseProvider
          .burnReservation(reservation.reservationId, 'sign-request-failed')
          .catch(() => {});
        throw err;
      }
    },
  };
}


/** Durable audit record for every policy-signer decision (RFC-061 D6). */
export interface SignerAuditRecord {
  requestId: string;
  domain: SignDomain;
  mode: CustodyMode;
  disclosureId: string;
  acknowledgementId?: string;
  signer: string;
  decision: 'allow' | 'deny';
  reason?: string;
}

/** Hosted/KMS policy checks applied before delegating to the underlying port. */
export interface SignerPolicy {
  allowedDomains?: SignDomain[];
  allowedModes?: CustodyMode[];
  /** Reject requests whose declared amount exceeds this value (base units). */
  maxAmount?: bigint;
  /** Require a disclosure hash/version on the custody context. */
  requireDisclosure?: boolean;
  /** RFC-061 signer gate: exact disclosure acknowledgement + policy decision. */
  custody?: {
    acknowledgement?: CustodyAcknowledgement;
    subjectId?: string;
    policyDecision?: 'allow' | 'deny';
    now?: number;
  };
  /** Durable audit sink; called with allow/deny decisions. */
  audit?: (record: SignerAuditRecord) => void | Promise<void>;
  /** Additional operator approval hook (KMS/HSM/MPC or quorum). */
  authorize?: (request: SignRequest) => void | Promise<void>;
}

/**
 * Wrap a signer port with policy checks. The underlying port may be a local
 * signer, KMS/HSM/MPC adapter, or hosted policy engine; this wrapper only
 * enforces the deployment policy and disclosure requirements.
 */
export function createPolicySignerPort(base: SignerPort, policy: SignerPolicy = {}): SignerPort {
  return {
    publicKeyDigest: base.publicKeyDigest,
    async sign(request: SignRequest): Promise<Uint8Array> {
      assertSignRequest(request);
      if (!request.signers.includes(base.publicKeyDigest)) {
        throw new Error(`signer ${base.publicKeyDigest} is not a required signer for ${request.requestId}`);
      }
      const ack = policy.custody?.acknowledgement;
      const auditBase: Omit<SignerAuditRecord, 'decision'> = {
        requestId: request.requestId,
        domain: request.domain,
        mode: request.custody.mode,
        disclosureId: custodyDisclosureId(request.custody),
        ...(ack
          ? { acknowledgementId: `${ack.disclosureId}:${ack.subjectId}:${ack.acknowledgedAt}` }
          : {}),
        signer: base.publicKeyDigest,
      };
      try {
        assertCustodyAllowsSigning(request, policy.custody ?? {});
      } catch (err) {
        await policy.audit?.({
          ...auditBase,
          decision: 'deny',
          reason: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
      if (policy.allowedDomains && !policy.allowedDomains.includes(request.domain)) {
        throw new Error(`domain ${request.domain} is not allowed by policy`);
      }
      if (policy.allowedModes && !policy.allowedModes.includes(request.custody.mode)) {
        throw new Error(`custody mode ${request.custody.mode} is not allowed by policy`);
      }
      if (policy.requireDisclosure && (!request.custody.disclosureHash || !request.custody.disclosureVersion)) {
        throw new Error('policy requires a disclosure hash and version');
      }
      const amount = request.context.amount;
      if (policy.maxAmount !== undefined && amount !== undefined) {
        const parsed = BigInt(amount);
        if (parsed > policy.maxAmount) {
          throw new Error(`request amount ${parsed} exceeds policy limit ${policy.maxAmount}`);
        }
      }
      await policy.authorize?.(request);
      const signature = await base.sign(request);
      await policy.audit?.({ ...auditBase, decision: 'allow' });
      return signature;
    },
  };
}
