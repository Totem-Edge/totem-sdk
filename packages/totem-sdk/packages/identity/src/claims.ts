/**
 * Claim creation helpers.
 *
 * Claim IDs are deterministic: SHA3-256 of claim fields + canonical payload hash.
 */

import { sha3_256 } from '@totemsdk/core';
import { canonicalJson, toHex } from './canonical.js';
import type { IdentityClaim, IdentityClaimType } from './types.js';

function computeClaimId(
  type: IdentityClaimType,
  issuer: string,
  subject: string,
  object: string,
  issuedAt: number,
  payload: Record<string, unknown>,
): string {
  const canonical = canonicalJson({ type, issuer, subject, object, issuedAt, payload });
  const hash = sha3_256(new TextEncoder().encode(canonical));
  return toHex(hash);
}

export function createIdentityClaim(opts: {
  type: IdentityClaimType;
  issuer: string;
  subject: string;
  object: string;
  payload: Record<string, unknown>;
  issuedAt?: number;
  expiresAt?: number;
}): IdentityClaim {
  const { type, issuer, subject, object, payload, expiresAt } = opts;
  const issuedAt = opts.issuedAt ?? Date.now();
  const id = computeClaimId(type, issuer, subject, object, issuedAt, payload);
  return {
    id,
    type,
    issuer,
    subject,
    object,
    issuedAt,
    ...(expiresAt !== undefined ? { expiresAt } : {}),
    payload,
  };
}

export function createDelegationClaim(opts: {
  issuer: string;
  subject: string;
  delegatedAddress: string;
  scopes: string[];
  issuedAt?: number;
  expiresAt?: number;
}): IdentityClaim {
  const { issuer, subject, delegatedAddress, scopes, expiresAt } = opts;
  return createIdentityClaim({
    type: 'delegates_to',
    issuer,
    subject,
    object: delegatedAddress,
    payload: { scopes },
    issuedAt: opts.issuedAt,
    expiresAt,
  });
}

export function createPaymentRecipientClaim(opts: {
  issuer: string;
  subject: string;
  address: string;
  label?: string;
  issuedAt?: number;
  expiresAt?: number;
}): IdentityClaim {
  const { issuer, subject, address, label, expiresAt } = opts;
  const payload: Record<string, unknown> = {};
  if (label !== undefined) payload.label = label;
  return createIdentityClaim({
    type: 'payment_recipient',
    issuer,
    subject,
    object: address,
    payload,
    issuedAt: opts.issuedAt,
    expiresAt,
  });
}

export function createServiceEndpointClaim(opts: {
  issuer: string;
  subject: string;
  endpointType: string;
  uri: string;
  issuedAt?: number;
  expiresAt?: number;
}): IdentityClaim {
  const { issuer, subject, endpointType, uri, expiresAt } = opts;
  return createIdentityClaim({
    type: 'service_endpoint',
    issuer,
    subject,
    object: uri,
    payload: { endpointType },
    issuedAt: opts.issuedAt,
    expiresAt,
  });
}
