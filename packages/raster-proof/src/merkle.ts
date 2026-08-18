/**
 * Edge-safe Merkle chunking and proof for @totemsdk/raster-proof.
 *
 * DOMAIN SEPARATION: chunk content hashes are SHA3-256 of the raw bytes;
 * Merkle leaves and internal nodes are domain-separated so a chunk hash can
 * never be confused with a node hash:
 *   leaf = sha3_256("totem-raster-leaf" + chunk.hash)
 *   node = sha3_256("totem-raster-node" + left + right)
 *
 * ODD-LAYER RULE (deterministic): when a Merkle level has an odd number of
 * hashes, the last hash is PROMOTED unchanged to the next level (it is NOT
 * duplicated/hashed with itself). This is the standard RFC 6962-style rule
 * and keeps the tree compact and deterministic.
 *
 * Empty byte arrays are rejected — a raster asset must have bytes.
 */

import { sha3_256 } from '@totemsdk/core';
import { toHex } from './canonical.js';
import { hashBytes } from './hash.js';
import type {
  RasterChunk,
  RasterMerkleOptions,
  RasterMerkleProof,
  RasterMerkleSummary,
} from './types.js';

const LEAF_PREFIX = 'totem-raster-leaf';
const NODE_PREFIX = 'totem-raster-node';
export const DEFAULT_CHUNK_SIZE_BYTES = 64 * 1024; // 64 KiB

function domainHash(prefix: string, a: string, b?: string): string {
  const encoder = new TextEncoder();
  const payload = b === undefined ? prefix + a : prefix + a + b;
  return toHex(sha3_256(encoder.encode(payload)));
}

/**
 * Domain-separated Merkle leaf hash for a chunk. A user proving "this chunk
 * is in this tree" recomputes merkleLeafHash(chunk) and compares it to
 * RasterMerkleProof.leafHash before verifying the sibling chain.
 */
export function merkleLeafHash(chunk: RasterChunk): string {
  return domainHash(LEAF_PREFIX, chunk.hash);
}

function merkleNodeHash(left: string, right: string): string {
  return domainHash(NODE_PREFIX, left, right);
}

/**
 * Split bytes into fixed-size chunks (default 64 KiB). Each chunk carries a
 * content hash of its raw bytes. Empty input is rejected.
 */
export function chunkBytes(bytes: Uint8Array, chunkSizeBytes: number = DEFAULT_CHUNK_SIZE_BYTES): RasterChunk[] {
  if (bytes.length === 0) {
    throw new Error('cannot chunk empty bytes; a raster asset must have content');
  }
  if (!Number.isInteger(chunkSizeBytes) || chunkSizeBytes <= 0) {
    throw new Error('chunk size must be a positive integer');
  }

  const chunks: RasterChunk[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSizeBytes) {
    const length = Math.min(chunkSizeBytes, bytes.length - offset);
    chunks.push({
      index: chunks.length,
      offset,
      length,
      hash: hashBytes(bytes.subarray(offset, offset + length)),
    });
  }
  return chunks;
}

function buildLevels(leafHashes: string[]): string[][] {
  const levels: string[][] = [leafHashes];
  while (levels[levels.length - 1].length > 1) {
    const cur = levels[levels.length - 1];
    const next: string[] = [];
    for (let i = 0; i < cur.length; i += 2) {
      if (i + 1 < cur.length) {
        next.push(merkleNodeHash(cur[i], cur[i + 1]));
      } else {
        next.push(cur[i]); // promote the odd last hash unchanged
      }
    }
    levels.push(next);
  }
  return levels;
}

/**
 * Compute the Merkle root over chunk hashes (deterministic). Odd layers
 * promote the last hash unchanged.
 */
export function computeMerkleRoot(chunks: RasterChunk[]): string {
  if (chunks.length === 0) {
    throw new Error('cannot compute a Merkle root over zero chunks');
  }
  const levels = buildLevels(chunks.map((c) => merkleLeafHash(c)));
  return levels[levels.length - 1][0];
}

/**
 * Build a Merkle inclusion proof for one chunk. The proof's leafHash is the
 * domain-separated leaf hash of that chunk. Callers can reproduce it with
 * merkleLeafHash(chunks[leafIndex]).
 */
export function createMerkleProof(chunks: RasterChunk[], leafIndex: number): RasterMerkleProof {
  if (chunks.length === 0) {
    throw new Error('cannot create a Merkle proof over zero chunks');
  }
  if (!Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= chunks.length) {
    throw new Error(`leafIndex ${leafIndex} out of range [0, ${chunks.length})`);
  }

  const levels = buildLevels(chunks.map((c) => merkleLeafHash(c)));
  const siblings: Array<{ position: 'left' | 'right'; hash: string }> = [];
  let idx = leafIndex;

  for (let level = 0; level < levels.length - 1; level++) {
    const cur = levels[level];
    const odd = cur.length % 2 === 1;
    if (odd && idx === cur.length - 1) {
      // Last element of an odd level is promoted unchanged — no sibling here,
      // the node itself moves up one level.
      idx = Math.floor(cur.length / 2);
      continue;
    }
    const siblingIndex = idx % 2 === 0 ? idx + 1 : idx - 1;
    siblings.push({
      position: idx % 2 === 0 ? 'right' : 'left',
      hash: cur[siblingIndex],
    });
    idx = Math.floor(idx / 2);
  }

  return {
    root: levels[levels.length - 1][0],
    leafHash: merkleLeafHash(chunks[leafIndex]),
    leafIndex,
    siblings,
    hashAlgorithm: 'sha3-256',
  };
}

/**
 * Verify a Merkle inclusion proof against its own root. Structural check —
 * recomputes the root from leafHash + siblings and compares.
 */
export function verifyMerkleProof(proof: RasterMerkleProof): boolean {
  if (proof.hashAlgorithm !== 'sha3-256') return false;
  if (!proof.root || !proof.leafHash || proof.leafIndex < 0) return false;
  if (!/^[a-f0-9]{64}$/.test(proof.root) || !/^[a-f0-9]{64}$/.test(proof.leafHash)) return false;

  let h = proof.leafHash;
  for (const sibling of proof.siblings) {
    if (!/^[a-f0-9]{64}$/.test(sibling.hash)) return false;
    h = sibling.position === 'left' ? merkleNodeHash(sibling.hash, h) : merkleNodeHash(h, sibling.hash);
  }
  return h === proof.root;
}

/**
 * Hash bytes, chunk them, and summarize in one edge-safe pass.
 */
export function createRasterMerkleSummary(
  bytes: Uint8Array,
  options: RasterMerkleOptions = {},
): RasterMerkleSummary {
  const chunkSizeBytes = options.chunkSizeBytes ?? DEFAULT_CHUNK_SIZE_BYTES;
  const contentHash = hashBytes(bytes);
  const chunks = chunkBytes(bytes, chunkSizeBytes);
  return {
    contentHash,
    merkleRoot: computeMerkleRoot(chunks),
    chunkSizeBytes,
    chunkCount: chunks.length,
    byteSize: bytes.length,
  };
}
