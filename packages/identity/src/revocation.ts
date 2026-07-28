/**
 * Identity revocation — produces a RevocationClaim.
 */

import { createIdentityClaim } from './claims.js';
import type { IdentityClaim } from './types.js';

export function revokeIdentity(opts: {
  issuer: string;
  subject: string;
  reason?: string;
  issuedAt?: number;
}): IdentityClaim {
  const { issuer, subject, reason } = opts;
  const payload: Record<string, unknown> = {};
  if (reason !== undefined) payload.reason = reason;
  return createIdentityClaim({
    type: 'revokes',
    issuer,
    subject,
    object: subject,
    payload,
    issuedAt: opts.issuedAt,
  });
}
