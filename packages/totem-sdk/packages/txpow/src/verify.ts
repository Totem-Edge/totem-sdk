/**
 * verify.ts — TxPoW proof-of-work verification.
 *
 * verifyProofOfWork checks that a given txpowId beats the difficulty target
 * without re-mining. Used by relay nodes to reject under-work submissions.
 *
 * verifyTxPoWWork receives raw TxPoW hex, parses the header/body split by
 * verifying the embedded body-hash field, computes the canonical txpowId
 * (SHA3-256 of the header only), extracts mTxnDifficulty from the TxBody,
 * and checks txpowId < mTxnDifficulty. Falls back to the TX_POW_MIN_DIFFICULTY
 * floor when parsing fails (malformed or non-standard TxPoW).
 *
 * verifyTxPoWParts is the low-level variant for callers who already hold
 * pre-split header/body bytes.
 *
 * ── Wire format reference ─────────────────────────────────────────────────
 * @totemsdk/core's writeHashToStream(hash) uses a 4-byte big-endian length
 * prefix followed by the bytes: for a 32-byte hash → [0x00,0x00,0x00,0x20, ...32 bytes]
 * = 36 bytes total. writeMiniData uses the same 4-byte prefix format.
 *
 * TxPoW wire format:  TxHeader bytes | 0x01 (hasBody) | TxBody bytes
 * TxPoW ID:           SHA3-256(TxHeader bytes)
 *
 * TxHeader ends with:
 *   writeHashToStream(mCustomHash)  — [0x00,0x00,0x00,0x20, ...32 zeros]   36 bytes
 *   writeHashToStream(mTxBodyHash) — [0x00,0x00,0x00,0x20, ...32 bytes]   36 bytes
 *
 * TxBody starts with:
 *   writeHashToStream(mPRNG)        — [0x00,0x00,0x00,0x20, ...32 bytes]   36 bytes
 *   writeMiniData(mTxnDifficulty)   — [0x00,0x00,0x00,len,  ...len bytes]  4+len bytes
 */

import { sha3_256 } from '@totemsdk/core';
import { isLessThan } from './mine.js';
import { computeTxPoWId } from './serialization.js';
import { TX_POW_MIN_DIFFICULTY } from './constants.js';

export interface VerifyResult {
  valid: boolean;
  txpowId: string;
  difficulty: string;
  reason?: string;
}

function toHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Read a big-endian 4-byte unsigned integer from bytes at offset. */
function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

/**
 * Verify that a TxPoW ID beats the stated difficulty target.
 *
 * valid = txpowId < mTxnDifficulty (big-endian 256-bit comparison)
 *
 * @param txpowId        The 32-byte TxPoW ID (SHA3-256 of the header).
 * @param mTxnDifficulty The 32-byte difficulty target from the TxBody.
 */
export function verifyProofOfWork(
  txpowId: Uint8Array,
  mTxnDifficulty: Uint8Array
): VerifyResult {
  if (txpowId.length !== 32) {
    return {
      valid: false,
      txpowId: toHex(txpowId),
      difficulty: toHex(mTxnDifficulty),
      reason: `txpowId must be 32 bytes, got ${txpowId.length}`,
    };
  }
  if (mTxnDifficulty.length !== 32) {
    return {
      valid: false,
      txpowId: toHex(txpowId),
      difficulty: toHex(mTxnDifficulty),
      reason: `mTxnDifficulty must be 32 bytes, got ${mTxnDifficulty.length}`,
    };
  }

  const valid = isLessThan(txpowId, mTxnDifficulty);
  return {
    valid,
    txpowId: toHex(txpowId),
    difficulty: toHex(mTxnDifficulty),
    reason: valid ? undefined : 'txpowId ≥ mTxnDifficulty',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TxPoW header/body parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt to split raw TxPoW bytes into (headerBytes, bodyBytes).
 *
 * TxPoW wire format:  TxHeader | 0x01 (hasBody byte) | TxBody
 * TxPoW ID:           SHA3-256(TxHeader)
 *
 * The header always ends with `writeHashToStream(sha3_256(TxBody))`.
 * @totemsdk/core writeHashToStream uses a 4-byte big-endian length prefix:
 *   [0x00, 0x00, 0x00, 0x20, ...32 body-hash bytes] = 36 bytes
 *
 * We scan forward looking for a 0x01 hasBody byte where:
 *   - The preceding 36 bytes are [0,0,0,32] + 32-byte bodyHash
 *   - sha3_256(bodyBytes) == those 32 bytes
 * When found the split is authenticated by the hash.
 *
 * Returns null when no valid split is found.
 */
function tryParseTxPoW(
  bytes: Uint8Array
): { headerBytes: Uint8Array; bodyBytes: Uint8Array } | null {
  // writeHashToStream(32-byte hash) = 36 bytes
  const HASH_FIELD_LEN = 36;
  // Minimum body: PRNG (36 bytes) + mTxnDifficulty prefix+data (4+1 minimum)
  const MIN_BODY = 41;
  // Minimum header must end with txBodyHash field (36 bytes)
  const MIN_HEADER = HASH_FIELD_LEN;
  const MIN_TOTAL = MIN_HEADER + 1 + MIN_BODY;

  if (bytes.length < MIN_TOTAL) return null;

  for (let i = MIN_HEADER; i <= bytes.length - MIN_BODY - 1; i++) {
    if (bytes[i] !== 0x01) continue;

    const headerBytes = bytes.slice(0, i);
    if (headerBytes.length < HASH_FIELD_LEN) continue;

    // Last 36 bytes of header = writeHashToStream(bodyHash)
    // = [0x00, 0x00, 0x00, 0x20, ...32 bytes]
    const hashFieldStart = headerBytes.length - HASH_FIELD_LEN;
    if (
      headerBytes[hashFieldStart] !== 0x00 ||
      headerBytes[hashFieldStart + 1] !== 0x00 ||
      headerBytes[hashFieldStart + 2] !== 0x00 ||
      headerBytes[hashFieldStart + 3] !== 0x20
    ) {
      continue;
    }

    const embeddedBodyHash = headerBytes.slice(hashFieldStart + 4);
    const bodyBytes = bytes.slice(i + 1);

    const actualBodyHash = sha3_256(bodyBytes);
    if (actualBodyHash.every((b, j) => b === embeddedBodyHash[j])) {
      return { headerBytes, bodyBytes };
    }
  }

  return null;
}

/**
 * Extract mTxnDifficulty from TxBody bytes.
 *
 * TxBody wire format (using @totemsdk/core serialization):
 *   [0..3]   [0x00,0x00,0x00,0x20]   4-byte big-endian length (32) for PRNG
 *   [4..35]  prng bytes               32-byte random nonce
 *   [36..39] [0x00,0x00,0x00,len]    4-byte big-endian length for mTxnDifficulty
 *   [40..40+len-1] difficulty bytes  len bytes (standard: 32)
 *
 * Returns null when the body is too short or length prefixes are invalid.
 */
function extractTxnDifficulty(bodyBytes: Uint8Array): Uint8Array | null {
  // PRNG field: 4-byte length prefix + 32 bytes = 36 bytes total
  if (bodyBytes.length < 40) return null;
  // Length prefix for PRNG must be 0x00000020 (= 32)
  if (
    bodyBytes[0] !== 0x00 ||
    bodyBytes[1] !== 0x00 ||
    bodyBytes[2] !== 0x00 ||
    bodyBytes[3] !== 0x20
  ) {
    return null;
  }

  // After PRNG (36 bytes), the next 4 bytes are the length prefix for mTxnDifficulty
  const diffLen = readUint32BE(bodyBytes, 36);
  if (diffLen === 0 || 40 + diffLen > bodyBytes.length) return null;

  return bodyBytes.slice(40, 40 + diffLen);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public verification API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify a TxPoW from pre-split header and body bytes.
 *
 * Computes SHA3-256(headerBytes) as the txpowId, extracts mTxnDifficulty
 * from the body, and checks txpowId < mTxnDifficulty. Falls back to
 * TX_POW_MIN_DIFFICULTY when the body cannot be parsed.
 *
 * @param headerBytes  Raw TxHeader bytes (SHA3-256 of these is the txpowId).
 * @param bodyBytes    Raw TxBody bytes (mTxnDifficulty extracted from here).
 */
export function verifyTxPoWParts(
  headerBytes: Uint8Array,
  bodyBytes: Uint8Array
): VerifyResult {
  const txpowId = computeTxPoWId(headerBytes);
  const difficulty = extractTxnDifficulty(bodyBytes) ?? TX_POW_MIN_DIFFICULTY;
  return verifyProofOfWork(txpowId, difficulty);
}

/**
 * Relay-side work verification from raw TxPoW hex.
 *
 * Parses the TxPoW hex into header and body by locating the hasBody byte via
 * body-hash verification. Computes the canonical TxPoW ID (SHA3-256 of the
 * header only), extracts mTxnDifficulty from the TxBody, and verifies:
 *   txpowId < mTxnDifficulty
 *
 * Falls back to TX_POW_MIN_DIFFICULTY as a spam filter when:
 *   - The hex is invalid or malformed
 *   - No valid header/body split can be found (non-standard structure)
 *   - mTxnDifficulty cannot be extracted from the body
 *
 * PureMinima performs authoritative work verification on submission; this
 * function is a first-pass relay-side filter.
 *
 * @param txpowHex  Hex-encoded serialized TxPoW (TxHeader | 0x01 | TxBody).
 */
export function verifyTxPoWWork(txpowHex: string): VerifyResult {
  if (typeof txpowHex !== 'string' || !/^[0-9a-fA-F]+$/.test(txpowHex)) {
    return {
      valid: false,
      txpowId: '',
      difficulty: toHex(TX_POW_MIN_DIFFICULTY),
      reason: 'invalid hex encoding',
    };
  }
  if (txpowHex.length < 200) {
    return {
      valid: false,
      txpowId: '',
      difficulty: toHex(TX_POW_MIN_DIFFICULTY),
      reason: 'TxPoW too short (spam filter: minimum 100 bytes)',
    };
  }

  const bytes = Uint8Array.from(Buffer.from(txpowHex, 'hex'));

  // Attempt to parse the TxPoW into header + body using body-hash verification
  const parsed = tryParseTxPoW(bytes);
  if (parsed) {
    return verifyTxPoWParts(parsed.headerBytes, parsed.bodyBytes);
  }

  // Fallback: use sha3_256 of the full bytes as a proxy id against the floor
  const proxyId = computeTxPoWId(bytes);
  return {
    ...verifyProofOfWork(proxyId, TX_POW_MIN_DIFFICULTY),
    reason: 'could not parse TxPoW structure — used proxy id against floor difficulty',
  };
}
