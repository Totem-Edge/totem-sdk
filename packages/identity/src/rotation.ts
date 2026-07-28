/**
 * Identity rotation — produces a RotationClaim.
 */

import { createIdentityClaim } from './claims.js';
import type { IdentityClaim } from './types.js';

export function rotateIdentity(opts: {
  issuer: string;
  subject: string;
  newAddress: string;
  issuedAt?: number;
}): IdentityClaim {
  const { issuer, subject, newAddress } = opts;
  return createIdentityClaim({
    type: 'rotates_to',
    issuer,
    subject,
    object: newAddress,
    payload: {},
    issuedAt: opts.issuedAt,
  });
}
