/**
 * admission/template.ts — Minima block-candidate template handling.
 *
 * Builds a TxHeader tail that is structurally capable of becoming a legitimate
 * Minima block. The fields (block number, block difficulty, super-parents, MMR
 * root/total, magic, time) come from the current chain tip via an injected
 * MinimaWorkTemplateProvider — mirroring TxPoWGenerator.generateTxPoW in
 * Minima. The action commitment is placed in the header's customHash field.
 *
 * The TxPoW package stays transport/node-client agnostic: callers inject the
 * template provider. A real Minima node / Axia integration supplies live chain
 * state; tests supply fixtures.
 */

import { sha3_256 } from '@totemsdk/core';
import {
  writeMiniNumber,
  writeMiniData,
  writeHashToStream,
  concat,
} from '@totemsdk/core';
import { serializeMagic } from '../magic.js';
import { CASCADE_LEVELS } from '../constants.js';
import type { MinimaWorkTemplate } from './types.js';

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) {
    out[i / 2] = parseInt(h.slice(i, i + 2), 16);
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Serialize the super-parent RLE runs per TxHeader.writeDataStream.
 *
 * Consecutive equal hashes are coalesced into (count: MiniByte, hash) runs.
 * A fresh candidate with all-distinct parents serializes as 32 runs.
 */
export function serializeSuperParents(superParents: string[]): Uint8Array {
  if (superParents.length !== CASCADE_LEVELS) {
    throw new Error(
      `superParents must have ${CASCADE_LEVELS} entries, got ${superParents.length}`
    );
  }
  const parts: Uint8Array[] = [];
  let runHash = superParents[0];
  let runCount = 1;
  for (let i = 1; i < superParents.length; i++) {
    if (superParents[i] === runHash) {
      runCount++;
    } else {
      parts.push(new Uint8Array([runCount]));
      parts.push(writeHashToStream(hexToBytes(runHash)));
      runHash = superParents[i];
      runCount = 1;
    }
  }
  parts.push(new Uint8Array([runCount]));
  parts.push(writeHashToStream(hexToBytes(runHash)));
  return concat(...parts);
}

/**
 * Build the empty burn transaction bytes (TxBody.writeDataStream fields 5-6).
 *
 * Equivalent to serializeTransaction({ linkHash: [0x00], inputs: [], outputs: [],
 * state: [] }): 0 inputs, 0 outputs, 0 state, linkHash = ZERO_TXPOWID (1 byte).
 */
export function buildEmptyBurnTxBytes(): Uint8Array {
  return concat(
    writeMiniNumber(0n, 0),
    writeMiniNumber(0n, 0),
    writeMiniNumber(0n, 0),
    writeHashToStream(new Uint8Array([0x00]))
  );
}

/**
 * Build the empty burn witness bytes (TxBody.writeDataStream field 6).
 * 0 signatures, 0 coinproofs, 0 scriptproofs.
 */
export function buildEmptyBurnWitnessBytes(): Uint8Array {
  return concat(
    writeMiniNumber(0n, 0),
    writeMiniNumber(0n, 0),
    writeMiniNumber(0n, 0)
  );
}

/**
 * Build the empty transaction bytes (TxBody.writeDataStream field 3).
 * 0 inputs, 0 outputs, 0 state, linkHash = ZERO_TXPOWID (1 byte).
 */
export function buildEmptyTransactionBytes(): Uint8Array {
  return concat(
    writeMiniNumber(0n, 0),
    writeMiniNumber(0n, 0),
    writeMiniNumber(0n, 0),
    writeHashToStream(new Uint8Array([0x00]))
  );
}

/**
 * Build the empty witness bytes (TxBody.writeDataStream field 4).
 * 0 signatures, 0 coinproofs, 0 scriptproofs.
 */
export function buildEmptyWitnessBytes(): Uint8Array {
  return concat(
    writeMiniNumber(0n, 0),
    writeMiniNumber(0n, 0),
    writeMiniNumber(0n, 0)
  );
}

/**
 * Build the serialized TxBody for a fresh block candidate.
 *
 * Mirrors TxBody.writeDataStream with an empty transaction and witness (the
 * same shape Minima's MINEPULSE automine uses for block candidates):
 *   mPRNG | mTxnDifficulty | mTransaction | mWitness |
 *   mBurnTransaction | mBurnWitness | mTxPowIDList
 *
 * @param prng          32-byte PRNG (deterministic for tests; random otherwise).
 * @param txnDifficulty Transaction difficulty (32-byte hex). For a block
 *                      candidate this is typically the block difficulty.
 */
export function buildEmptyBlockBody(
  prng: Uint8Array,
  txnDifficulty: string
): Uint8Array {
  return concat(
    writeHashToStream(prng),
    writeMiniData(hexToBytes(txnDifficulty)),
    buildEmptyTransactionBytes(),
    buildEmptyWitnessBytes(),
    buildEmptyBurnTxBytes(),
    buildEmptyBurnWitnessBytes(),
    writeMiniNumber(0n, 0)
  );
}

/**
 * Assemble the complete Minima TxPoW wire format:
 *   TxHeader | 0x01 (hasBody) | TxBody
 *
 * This is the representation required for network submission of a genuine L1
 * block candidate. A mined header alone is NOT sufficient.
 *
 * @param headerBytes  Serialized TxHeader bytes (with the winning nonce).
 * @param bodyBytes    Serialized TxBody bytes.
 */
export function assembleTxPoWEnvelope(
  headerBytes: Uint8Array,
  bodyBytes: Uint8Array
): Uint8Array {
  return concat(headerBytes, new Uint8Array([0x01]), bodyBytes);
}

/**
 * Build the TxHeader tail (everything after the nonce field) for a block
 * candidate with the given customHash commitment.
 *
 * Field order (TxHeader.writeDataStream):
 *   mNonce | mChainID | mTimeMilli | mBlockNumber | mBlockDifficulty |
 *   super-parents RLE | mMMRRoot | mMMRTotal | mMagic | mCustomHash | mTxBodyHash
 *
 * @param template     The current Minima work template.
 * @param customHash   The action commitment (32-byte hex) to place in mCustomHash.
 * @param txBodyHash   SHA3-256 of the serialized TxBody (32-byte hex).
 */
export function buildBlockHeaderTail(
  template: MinimaWorkTemplate,
  customHash: string,
  txBodyHash: string
): Uint8Array {
  return concat(
    writeMiniData(hexToBytes(template.chainId)),
    writeMiniNumber(template.timeMilli, 0),
    writeMiniNumber(template.blockNumber, 0),
    writeMiniData(hexToBytes(template.blockDifficulty)),
    serializeSuperParents(template.superParents),
    writeHashToStream(hexToBytes(template.mmrRoot)),
    writeMiniNumber(template.mmrTotal, 0),
    hexToBytes(template.magic),
    writeHashToStream(hexToBytes(customHash)),
    writeHashToStream(hexToBytes(txBodyHash))
  );
}

/**
 * Compute the TxPoW ID for a mined block-candidate header.
 * txpowId = SHA3-256(serialized TxHeader).
 */
export function computeBlockCandidateId(headerBytes: Uint8Array): Uint8Array {
  return sha3_256(headerBytes);
}

/**
 * Check whether a txpowId beats the block target (i.e. is a genuine Minima block).
 * valid = txpowId < blockDifficulty (big-endian 256-bit comparison).
 */
export function isBlockWinner(txpowId: Uint8Array, blockDifficulty: string): boolean {
  const target = hexToBytes(blockDifficulty);
  for (let i = 0; i < 32; i++) {
    if (txpowId[i] < target[i]) return true;
    if (txpowId[i] > target[i]) return false;
  }
  return false;
}

/** Java BigInteger.bitLength() for non-negative values. bitLength(0) = 0. */
function bigIntBitLength(x: bigint): number {
  if (x <= 0n) return 0;
  let bits = 0;
  let v = x;
  while (v > 0n) {
    v >>= 1n;
    bits++;
  }
  return bits;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let v = 0n;
  for (let i = 0; i < bytes.length; i++) {
    v = (v << 8n) | BigInt(bytes[i]);
  }
  return v;
}

/**
 * Compute the Minima Super level for a TxPoW ID against a block difficulty,
 * with Minima's exact integer semantics.
 *
 * From TxPoW.calculateTXPOWID() / getSuperLevel():
 *   quot  = blockDifficulty / txpowId          (unsigned BigInteger division)
 *   super = quot.bitLength() - 1               (floor(log2(quot)))
 *   if super >= MINIMA_CASCADE_LEVELS (32) → clamp to 31
 *
 * When the TxPoW is NOT a block (txpowId >= blockDifficulty), quot = 0,
 * bitLength(0) = 0, so super = -1.
 *
 * Result:
 *   -1   — not a Minima block
 *    0   — ordinary/base Minima block (Super-0)
 *    1..31 — Super-1 … Super-31 (stronger blocks; 31 is the maximum represented)
 *
 * @param txpowId        SHA3-256(header), 32 bytes.
 * @param blockDifficulty 32-byte hex block difficulty target.
 */
export function computeSuperLevel(txpowId: Uint8Array, blockDifficulty: string): number {
  const diffBigInt = bytesToBigInt(hexToBytes(blockDifficulty));
  const idBigInt = bytesToBigInt(txpowId);

  // Not a block: quot = 0 → super = -1
  if (idBigInt >= diffBigInt) return -1;

  const quot = diffBigInt / idBigInt;
  let superLevel = bigIntBitLength(quot) - 1;

  // Clamp to the maximum represented Super level, exactly as Minima does.
  if (superLevel >= CASCADE_LEVELS) {
    superLevel = CASCADE_LEVELS - 1;
  }

  return superLevel;
}

/**
 * Default staleness policy: a template is "current enough" for admission if it
 * was captured within the window, and "current" for L1 broadcast if it matches
 * the latest template id.
 */
export function templateFreshness(
  template: MinimaWorkTemplate,
  latest: MinimaWorkTemplate | null,
  options?: { admissionWindowMs?: number; now?: number }
): { admissionValid: boolean; broadcastable: boolean } {
  const now = options?.now ?? Date.now();
  const windowMs = options?.admissionWindowMs ?? 5 * 60 * 1000;
  const age = now - template.capturedAt;
  const admissionValid = age >= 0 && age <= windowMs;
  const broadcastable = latest !== null && template.templateId === latest.templateId;
  return { admissionValid, broadcastable };
}

/**
 * Reconstruct the complete Minima TxPoW envelope for a proof.
 *
 * Rebuilds the empty block TxBody deterministically, recomputes the body hash,
 * and reassembles header | 0x01 | body. Used by verification to confirm the
 * proof corresponds to a complete, Minima-serializable candidate.
 *
 * @param proofTemplate The template the proof was mined against.
 * @param headerBytes   The mined TxHeader bytes.
 * @param prng          The PRNG used when the proof was mined (32 bytes).
 */
export function reconstructTxPoWEnvelope(
  proofTemplate: MinimaWorkTemplate,
  headerBytes: Uint8Array,
  prng: Uint8Array
): { envelope: Uint8Array; bodyHash: string } {
  const body = buildEmptyBlockBody(prng, proofTemplate.blockDifficulty);
  const bodyHash = toHex(sha3_256(body));
  const envelope = assembleTxPoWEnvelope(headerBytes, body);
  return { envelope, bodyHash };
}
