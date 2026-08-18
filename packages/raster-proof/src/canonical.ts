/**
 * Canonical JSON, hashing, and stable ID rules for @totemsdk/raster-proof.
 *
 * canonicalJson and toHex are re-exported from @totemsdk/proof, which is the
 * canonical implementation across the Totem SDK (deterministic canonical JSON
 * with recursively sorted keys, lowercase hex without 0x prefix).
 *
 * ID rules:
 *   Raster manifest: "totem:raster:"        + sha3_256("totem-raster"        + canonicalJson(stableManifest))
 *   Raster window:   "totem:raster-window:" + sha3_256("totem-raster-window" + canonicalJson(stableWindow))
 *
 * Stable IDs deliberately exclude mutable / non-content fields so equivalent
 * logical content always produces the same identifier:
 *   raster manifest: rasterId, metadata
 *   raster window:   windowProofId, metadata
 */

import { sha3_256 } from '@totemsdk/core';
import { canonicalJson, toHex } from '@totemsdk/proof';
import type { RasterManifest, RasterWindowProof } from './types.js';

export { canonicalJson, toHex };

const RASTER_PREFIX = 'totem-raster';
const RASTER_WINDOW_PREFIX = 'totem-raster-window';

function stableManifestInput(input: Omit<RasterManifest, 'rasterId'>): Record<string, unknown> {
  const { rasterId: _rasterId, metadata: _metadata, ...stable } = input as RasterManifest;
  return stable as unknown as Record<string, unknown>;
}

function stableWindowInput(input: Omit<RasterWindowProof, 'windowProofId'>): Record<string, unknown> {
  const { windowProofId: _windowProofId, metadata: _metadata, ...stable } = input as RasterWindowProof;
  return stable as unknown as Record<string, unknown>;
}

function hashStableManifest(input: Omit<RasterManifest, 'rasterId'>): string {
  const digest = sha3_256(new TextEncoder().encode(RASTER_PREFIX + canonicalJson(stableManifestInput(input))));
  return toHex(digest);
}

function hashStableWindow(input: Omit<RasterWindowProof, 'windowProofId'>): string {
  const digest = sha3_256(new TextEncoder().encode(RASTER_WINDOW_PREFIX + canonicalJson(stableWindowInput(input))));
  return toHex(digest);
}

/**
 * Compute the stable raster manifest ID: "totem:raster:<sha3-256-hex>".
 * Deterministic over stable fields — the same logical manifest always hashes
 * to the same identifier.
 */
export function computeRasterManifestId(input: Omit<RasterManifest, 'rasterId'>): string {
  return 'totem:raster:' + hashStableManifest(input);
}

/**
 * Hash a complete RasterManifest (excluding rasterId and metadata) to
 * lowercase SHA3-256 hex without a 0x prefix — the value used in
 * EvidenceRef.hash.
 */
export function hashRasterManifest(manifest: RasterManifest): string {
  const { rasterId: _rasterId, ...rest } = manifest;
  return hashStableManifest(rest);
}

/**
 * Compute the stable raster window proof ID: "totem:raster-window:<sha3-256-hex>".
 */
export function computeRasterWindowProofId(input: Omit<RasterWindowProof, 'windowProofId'>): string {
  return 'totem:raster-window:' + hashStableWindow(input);
}

/**
 * Hash a complete RasterWindowProof (excluding windowProofId and metadata)
 * to lowercase SHA3-256 hex without a 0x prefix.
 */
export function hashRasterWindowProof(proof: RasterWindowProof): string {
  const { windowProofId: _windowProofId, ...rest } = proof;
  return hashStableWindow(rest);
}
