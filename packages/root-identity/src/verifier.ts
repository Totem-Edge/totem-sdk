/**
 * Structural root-identity proof verifier (RFC-056 P0-B).
 *
 * This adapter lets identity/manifest/entity code verify an `OwnershipProof`
 * without importing the wallet implementation. Root ancestry is evidence of
 * membership; it never grants authorization.
 */
import { hashCanonical } from '@totemsdk/core';
import { UnifiedIdentityWallet } from './UnifiedIdentityWallet.js';
import type { OwnershipProof, WotsProof } from './types.js';

export interface RootIdentityVerificationContext {
  expectedRootAddress?: string;
  expectedAddress?: string;
  purpose?:
    | 'identity-resolution'
    | 'manifest-binding'
    | 'lookup-auth'
    | 'authority'
    | 'governance'
    | 'other';
}

export interface RootIdentityVerificationResult {
  valid: boolean;
  reason?: string;
  rootAddress?: string;
  provenAddresses?: string[];
  proofDigest?: string;
}

export interface RootIdentityProofVerifier {
  type: 'root-identity';
  verify(
    proof: unknown,
    context?: RootIdentityVerificationContext,
  ): Promise<RootIdentityVerificationResult>;
}

/** Serialize an ownership proof (opaque string carried in identity/manifest fields). */
export function encodeRootIdentityProof(proof: OwnershipProof): string {
  return JSON.stringify(proof);
}

/** Parse and shape-check a serialized ownership proof. */
export function decodeRootIdentityProof(encoded: string): OwnershipProof {
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    throw new Error('Invalid root identity proof: not JSON');
  }
  if (!isOwnershipProof(parsed)) {
    throw new Error('Invalid root identity proof: malformed shape');
  }
  return parsed;
}

function isWotsProof(value: unknown): value is WotsProof {
  if (!value || typeof value !== 'object') return false;
  const proof = value as Record<string, unknown>;
  return (
    typeof proof.address === 'string' &&
    typeof proof.publicKey === 'string' &&
    typeof proof.signature === 'string' &&
    typeof proof.message === 'string'
  );
}

function isOwnershipProof(value: unknown): value is OwnershipProof {
  if (!value || typeof value !== 'object') return false;
  const proof = value as Record<string, unknown>;
  return (
    typeof proof.rootAddress === 'string' &&
    typeof proof.rootPublicKey === 'string' &&
    typeof proof.timestamp === 'string' &&
    Array.isArray(proof.childAddresses) &&
    proof.childAddresses.every((address) => typeof address === 'string') &&
    Array.isArray(proof.childPublicKeys) &&
    proof.childPublicKeys.every((key) => typeof key === 'string') &&
    isWotsProof(proof.rootProof)
  );
}

function coerceProof(proof: unknown): OwnershipProof {
  if (typeof proof === 'string') return decodeRootIdentityProof(proof);
  if (isOwnershipProof(proof)) return proof;
  throw new Error('Invalid root identity proof: malformed shape');
}

/**
 * Create a structural verifier compatible with `IdentityProofVerifier`.
 *
 * Root ancestry is evidence only: consumers must still enforce authorization
 * through identity/authority. `expectedRootAddress` is mandatory for
 * identity/manifest binding; the verifier never widens an authorization scope.
 */
export function createRootIdentityProofVerifier(): RootIdentityProofVerifier {
  return {
    type: 'root-identity',
    async verify(
      proof: unknown,
      context: RootIdentityVerificationContext = {},
    ): Promise<RootIdentityVerificationResult> {
      let parsed: OwnershipProof;
      try {
        parsed = coerceProof(proof);
      } catch (err) {
        return { valid: false, reason: err instanceof Error ? err.message : String(err) };
      }

      const rootAddress = parsed.rootAddress;

      if (
        context.expectedRootAddress !== undefined &&
        context.expectedRootAddress !== rootAddress
      ) {
        return {
          valid: false,
          reason: `root address mismatch: proof '${rootAddress}' != expected '${context.expectedRootAddress}'`,
          rootAddress,
        };
      }

      if (!UnifiedIdentityWallet.verifyOwnershipProof(parsed)) {
        return {
          valid: false,
          reason: 'ownership proof verification failed',
          rootAddress,
        };
      }

      if (
        context.expectedAddress !== undefined &&
        context.expectedAddress !== rootAddress &&
        !parsed.childAddresses.includes(context.expectedAddress)
      ) {
        return {
          valid: false,
          reason: `address '${context.expectedAddress}' is not proven by root '${rootAddress}'`,
          rootAddress,
          provenAddresses: parsed.childAddresses,
        };
      }

      return {
        valid: true,
        rootAddress,
        provenAddresses: parsed.childAddresses,
        proofDigest: '0x' + hashCanonical('TOTEM_ROOT_IDENTITY_PROOF_V1', parsed),
      };
    },
  };
}
