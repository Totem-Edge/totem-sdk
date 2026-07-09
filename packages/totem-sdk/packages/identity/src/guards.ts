/**
 * Type guards for identity types.
 */

import type {
  TotemIdentityDocument,
  IdentityClaim,
  SignedIdentityClaim,
  RotationClaim,
  RevocationClaim,
} from './types.js';

export function isTotemIdentityDocument(value: unknown): value is TotemIdentityDocument {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.kind === 'string' &&
    typeof v.version === 'number' &&
    typeof v.rootAddress === 'string' &&
    typeof v.controllerAddress === 'string' &&
    typeof v.createdAt === 'number'
  );
}

export function isIdentityClaim(value: unknown): value is IdentityClaim {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.type === 'string' &&
    typeof v.issuer === 'string' &&
    typeof v.subject === 'string' &&
    typeof v.object === 'string' &&
    typeof v.issuedAt === 'number' &&
    typeof v.payload === 'object' &&
    v.payload !== null
  );
}

export function isSignedIdentityClaim(value: unknown): value is SignedIdentityClaim {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (!isIdentityClaim(v.claim)) return false;
  if (!v.proof || typeof v.proof !== 'object') return false;
  const p = v.proof as Record<string, unknown>;
  return (
    typeof p.address === 'string' &&
    typeof p.publicKey === 'string' &&
    typeof p.signature === 'string'
  );
}

export function isRotationClaim(value: unknown): value is RotationClaim {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.claimId === 'string' &&
    typeof v.issuer === 'string' &&
    typeof v.subject === 'string' &&
    typeof v.newAddress === 'string' &&
    typeof v.issuedAt === 'number'
  );
}

export function isRevocationClaim(value: unknown): value is RevocationClaim {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.claimId === 'string' &&
    typeof v.issuer === 'string' &&
    typeof v.subject === 'string' &&
    typeof v.issuedAt === 'number'
  );
}
