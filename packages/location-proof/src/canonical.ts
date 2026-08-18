/**
 * Canonical JSON, hashing, and stable ID rules for @totemsdk/location-proof.
 *
 * canonicalJson and toHex are re-exported from @totemsdk/proof, which is the
 * canonical implementation across the Totem SDK (deterministic canonical JSON
 * with recursively sorted keys, lowercase hex without 0x prefix).
 *
 * ID rules:
 *   Location claim:  "totem:location:" + sha3_256("totem-location-claim" + canonicalJson(stableClaim))
 *   Movement trail:  "totem:movement:" + sha3_256("totem-movement-trail" + canonicalJson(stableTrail))
 *
 * Stable IDs deliberately exclude mutable / derived fields so equivalent
 * logical content always produces the same identifier:
 *   claim:  claimId, receivedAt, confidenceScore, metadata
 *   trail:  trailId, maxComputedSpeedMps, impossibleJumpDetected, metadata
 */

import { sha3_256 } from '@totemsdk/core';
import { canonicalJson, toHex } from '@totemsdk/proof';
import type { LocationClaim, MovementTrail } from './types.js';

export { canonicalJson, toHex };

const CLAIM_PREFIX = 'totem-location-claim';
const TRAIL_PREFIX = 'totem-movement-trail';

function stableClaimInput(input: Omit<LocationClaim, 'claimId'>): Record<string, unknown> {
  const {
    claimId: _claimId,
    receivedAt: _receivedAt,
    confidenceScore: _confidenceScore,
    metadata: _metadata,
    ...stable
  } = input as LocationClaim;
  return stable as unknown as Record<string, unknown>;
}

function stableTrailInput(input: Omit<MovementTrail, 'trailId'>): Record<string, unknown> {
  const {
    trailId: _trailId,
    maxComputedSpeedMps: _maxComputedSpeedMps,
    impossibleJumpDetected: _impossibleJumpDetected,
    metadata: _metadata,
    ...stable
  } = input as MovementTrail;
  return stable as unknown as Record<string, unknown>;
}

function hashStableClaim(input: Omit<LocationClaim, 'claimId'>): string {
  const digest = sha3_256(new TextEncoder().encode(CLAIM_PREFIX + canonicalJson(stableClaimInput(input))));
  return toHex(digest);
}

function hashStableTrail(input: Omit<MovementTrail, 'trailId'>): string {
  const digest = sha3_256(new TextEncoder().encode(TRAIL_PREFIX + canonicalJson(stableTrailInput(input))));
  return toHex(digest);
}

/**
 * Hash a complete LocationClaim (excluding claimId and mutable fields)
 * to lowercase SHA3-256 hex without a 0x prefix.
 */
export function hashLocationClaim(claim: LocationClaim): string {
  const { claimId: _claimId, ...rest } = claim;
  return hashStableClaim(rest);
}

/**
 * Compute a stable URI-style claim ID: "totem:location:<sha3-256-hex>".
 * Callers pass the claim minus claimId; mutable fields are excluded internally.
 */
export function computeLocationClaimId(input: Omit<LocationClaim, 'claimId'>): string {
  return 'totem:location:' + hashStableClaim(input);
}

/**
 * Hash a complete MovementTrail (excluding trailId and derived fields)
 * to lowercase SHA3-256 hex without a 0x prefix.
 */
export function hashMovementTrail(trail: MovementTrail): string {
  const { trailId: _trailId, ...rest } = trail;
  return hashStableTrail(rest);
}

/**
 * Compute a stable URI-style movement trail ID: "totem:movement:<sha3-256-hex>".
 * Derived fields (maxComputedSpeedMps, impossibleJumpDetected) and metadata
 * are excluded so the ID depends only on the trail content.
 */
export function computeMovementTrailId(input: Omit<MovementTrail, 'trailId'>): string {
  return 'totem:movement:' + hashStableTrail(input);
}
