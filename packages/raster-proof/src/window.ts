/**
 * Raster window / tile proof construction for @totemsdk/raster-proof.
 *
 * A window proof attests that a subset of chunks (a spatial window, a tile,
 * a scene patch) belongs to a raster whose Merkle root is known. It carries
 * the chunk indices and their content hashes so a verifier can tie a specific
 * set of bytes to the root without re-hashing the whole asset.
 */

import type { EvidenceRef } from '@totemsdk/proof';
import type { CreateRasterWindowProofParams, RasterWindowProof } from './types.js';
import { computeRasterWindowProofId, hashRasterWindowProof } from './canonical.js';

/**
 * Create a deterministic RasterWindowProof. windowProofId is computed from
 * stable fields (everything except windowProofId and metadata).
 */
export function createRasterWindowProof(params: CreateRasterWindowProofParams): RasterWindowProof {
  const { rasterId, merkleRoot, chunkIndices, chunkHashes, spatial, createdAt = Date.now(), metadata } = params;

  if (chunkIndices.length === 0) {
    throw new Error('a window proof must reference at least one chunk');
  }
  if (chunkIndices.length !== chunkHashes.length) {
    throw new Error('chunkIndices and chunkHashes must have equal length');
  }
  for (const idx of chunkIndices) {
    if (!Number.isInteger(idx) || idx < 0) {
      throw new Error('chunk indices must be non-negative integers');
    }
  }
  for (const h of chunkHashes) {
    if (!/^[a-f0-9]{64}$/.test(h)) {
      throw new Error('chunk hashes must be 64-char lowercase hex (sha3-256)');
    }
  }
  if (!/^[a-f0-9]{64}$/.test(merkleRoot)) {
    throw new Error('merkleRoot must be 64-char lowercase hex (sha3-256)');
  }

  const body: Omit<RasterWindowProof, 'windowProofId'> = {
    rasterId,
    merkleRoot,
    chunkIndices,
    chunkHashes,
    ...(spatial !== undefined ? { spatial } : {}),
    createdAt,
    ...(metadata !== undefined ? { metadata } : {}),
  };
  return { ...body, windowProofId: computeRasterWindowProofId(body) };
}

/**
 * Convert a RasterWindowProof into an EvidenceRef for inclusion in a proof.
 */
export function rasterWindowProofToEvidenceRef(proof: RasterWindowProof): EvidenceRef {
  return {
    id: proof.windowProofId,
    kind: 'raster-window-proof',
    hash: hashRasterWindowProof(proof),
  };
}
