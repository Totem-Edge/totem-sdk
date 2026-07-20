import { createProof, signProof, signWithLease, verifyProof } from '@totemsdk/proof';
import { resolveIdentityGraph } from '@totemsdk/identity';
import type { UnsignedProof, SignedProof, ProofVerifyResult } from '@totemsdk/proof';
import type { IdentityGraph, ResolvedIdentity } from '@totemsdk/identity';
import type {
  MandateBody,
  MandateVerificationResult,
  AuthorityIdentityResolver,
  MandateStatusSnapshot,
} from './types.js';
import { computeMandateId } from './ids.js';

export interface CreateAgentMandateParams {
  grantor: string;
  grantee: string;
  principal: string;
  scope: string;
  constraints?: MandateBody['constraints'];
  usageLimit?: MandateBody['usageLimit'];
  issuedAt?: number;
  expiresAt?: number;
}

export function createAgentMandate(params: CreateAgentMandateParams): MandateBody {
  const mandate: MandateBody = {
    grantor: params.grantor,
    grantee: params.grantee,
    principal: params.principal,
    scope: params.scope,
    issuedAt: params.issuedAt ?? Date.now(),
  };
  if (params.constraints !== undefined) mandate.constraints = params.constraints;
  if (params.usageLimit !== undefined) mandate.usageLimit = params.usageLimit;
  if (params.expiresAt !== undefined) mandate.expiresAt = params.expiresAt;
  return mandate;
}

export function createMandateProofDraft(mandate: MandateBody): UnsignedProof {
  return createProof({
    kind: 'custom',
    subject: { id: mandate.grantee, kind: 'agent' },
    issuer: mandate.grantor,
    issuedAt: mandate.issuedAt,
    expiresAt: mandate.expiresAt,
    payload: {
      schema: 'totem:authority:mandate/v1',
      mandate,
    },
  });
}

export async function signMandateWithLease(
  unsignedMandate: UnsignedProof,
  seed: Uint8Array,
  leaseProvider: Parameters<typeof signWithLease>[2],
  options?: Parameters<typeof signWithLease>[3],
): Promise<SignedProof> {
  return signWithLease(unsignedMandate, seed, leaseProvider, options);
}

export function signMandateUnsafe(
  unsignedMandate: UnsignedProof,
  seed: Uint8Array,
  keyIndex: number,
): SignedProof {
  return signProof(unsignedMandate, seed, keyIndex);
}

function isGrantorAuthorized(
  grantingAddress: string,
  resolved: ResolvedIdentity,
): { authorized: boolean; reason?: string } {
  if (resolved.status !== 'active') {
    return { authorized: false, reason: `principal identity status is '${resolved.status}'` };
  }

  if (grantingAddress === resolved.rootAddress) {
    return { authorized: true };
  }

  if (grantingAddress === resolved.controllerAddress) {
    return { authorized: true };
  }

  const hasAuthorityScope = resolved.delegates.some(
    (d) =>
      d.delegatedAddress === grantingAddress &&
      (d.scopes.includes('*') || d.scopes.includes('authority:grant')),
  );

  if (hasAuthorityScope) {
    return { authorized: true };
  }

  return { authorized: false, reason: `grantor '${grantingAddress}' is not authorized to issue mandates` };
}

export function verifyMandate(
  mandate: SignedProof,
  identityResolver: AuthorityIdentityResolver,
  now: number,
  graceMs = 0,
  mandateStatus?: MandateStatusSnapshot,
): MandateVerificationResult {
  const result: MandateVerificationResult = {
    valid: false,
    identityVerified: false,
    scopeMatch: false,
    usageExceeded: false,
    expired: false,
    identityRevoked: false,
    mandateRevoked: false,
  };

  const payloadSchema = mandate.payload?.schema;
  if (payloadSchema !== 'totem:authority:mandate/v1') {
    result.reason = `invalid payload schema: ${String(payloadSchema)}`;
    return result;
  }

  const mandateBody = mandate.payload?.mandate as MandateBody | undefined;
  if (!mandateBody) {
    result.reason = 'missing mandate body in payload';
    return result;
  }

  result.mandateId = computeMandateId(mandateBody);
  result.grantorAddress = mandateBody.grantor;
  result.granteeAddress = mandateBody.grantee;
  result.principalId = mandateBody.principal;

  if (mandateStatus && mandateStatus.revokedMandateIds.includes(result.mandateId)) {
    result.valid = false;
    result.mandateRevoked = true;
    result.reason = 'mandate has been revoked';
    return result;
  }

  const proofResult: ProofVerifyResult = verifyProof(mandate, { graceMs, now });
  if (!proofResult.valid) {
    result.reason = proofResult.reason ?? 'proof verification failed';
    result.expired = proofResult.expired ?? false;
    return result;
  }

  if (proofResult.signerAddress !== mandateBody.grantor) {
    result.reason = `proof signer '${proofResult.signerAddress}' does not match grantor '${mandateBody.grantor}'`;
    return result;
  }

  if (mandateBody.expiresAt !== undefined && now > mandateBody.expiresAt + graceMs) {
    result.valid = false;
    result.expired = true;
    result.reason = 'mandate has expired';
    return result;
  }

  const principalGraph = identityResolver.resolve(mandateBody.principal);
  if (!principalGraph) {
    result.reason = `identity not found for principal '${mandateBody.principal}'`;
    return result;
  }

  if (principalGraph.document.id !== mandateBody.principal) {
    result.reason = `resolved identity ID '${principalGraph.document.id}' does not match requested '${mandateBody.principal}'`;
    return result;
  }

  const resolvedResult = resolveIdentityGraph(principalGraph);
  if (!resolvedResult.resolved) {
    result.reason = 'identity graph could not be resolved';
    return result;
  }

  const resolved = resolvedResult.resolved;

  if (resolved.status !== 'active') {
    result.identityRevoked = resolved.status === 'revoked';
    result.reason = `principal identity status is '${resolved.status}'`;
    return result;
  }

  const authCheck = isGrantorAuthorized(mandateBody.grantor, resolved);
  if (!authCheck.authorized) {
    result.reason = authCheck.reason ?? 'grantor not authorized';
    return result;
  }

  result.identityVerified = true;
  result.scopeMatch = true;
  result.expired = false;
  result.valid = true;

  return result;
}
