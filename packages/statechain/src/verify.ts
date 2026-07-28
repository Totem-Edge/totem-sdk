import { sha3_256 } from '@totemsdk/core';
import { hexToBytes, wotsVerifyDigest, derivePKdigest, bytesToHex } from '@totemsdk/core';
import type { StateChain } from './types.js';

export interface VerifyResult {
  valid: boolean;
  depth: number;
  rootOwner: string;
  reason?: string;
}

export interface VerifyOptions {
  /**
   * Override SE blind-signature verification.
   * Default: `wotsVerifyDigest(hexToBytes(sig), commitment, hexToBytes(sePkdHex))`
   * Tests override because mock SE sigs use SHA3-256.
   */
  verifyBlindSig?: (sig: string, commitment: Uint8Array, sePkdHex: string) => boolean;

  /**
   * Override old-owner signature verification per hop.
   * Default: `wotsVerifyDigest(hexToBytes(ownerSig), commitment, hexToBytes(fromPkdHex))`
   * Tests override because mock owner sigs use SHA3-256.
   */
  verifyOwnerSig?: (ownerSig: string, commitment: Uint8Array, fromPkdHex: string) => boolean;

  /**
   * Override transferKey lineage verification.
   * Default: `bytesToHex(derivePKdigest(hexToBytes(transferKey), 0)) === fromPublicKeyDigest`
   * Tests override because mock seeds are not real WOTS seeds.
   */
  verifyTransferKey?: (transferKey: string, fromPublicKeyDigest: string) => boolean;
}

function defaultVerifyBlindSig(sig: string, commitment: Uint8Array, sePkdHex: string): boolean {
  return wotsVerifyDigest(hexToBytes(sig), commitment, hexToBytes(sePkdHex));
}

function defaultVerifyOwnerSig(
  ownerSig: string, commitment: Uint8Array, fromPkdHex: string,
): boolean {
  return wotsVerifyDigest(hexToBytes(ownerSig), commitment, hexToBytes(fromPkdHex));
}

function defaultVerifyTransferKey(transferKey: string, fromPublicKeyDigest: string): boolean {
  if (!transferKey) return false;
  try {
    const seed = hexToBytes(transferKey);
    if (seed.length !== 32) return false;
    return bytesToHex(derivePKdigest(seed, 0)) === fromPublicKeyDigest;
  } catch {
    return false;
  }
}

/**
 * Verify the full transfer history of a statechain.
 *
 * For each TransferRecord, verifies:
 *  1. Chain continuity: party IDs and PKDs are linked hop-by-hop.
 *  2. Transfer key lineage: derivePKdigest(transferKey, 0) === fromPublicKeyDigest.
 *  3. Digest provenance: sha3_256(txBodyHex) === signedDigest.
 *     Prevents a malicious record from pairing valid signatures over one digest
 *     with unrelated `txHex`. Binds all signatures to the actual TX data.
 *  4. SE blind signature: verifies `blindedSignature` over `signedDigest`.
 *  5. Old-owner signature: verifies `ownerSignature` over `signedDigest`.
 *     Proves the old owner — not just the SE — authorised this state transition.
 *
 * Then validates that `currentOwner` matches the last transfer recipient.
 */
export function verifyStateChain(chain: StateChain, opts?: VerifyOptions): VerifyResult {
  const history   = chain.transferHistory;
  const depth     = history.length;
  const rootOwner = depth === 0 ? chain.currentOwner.partyId : history[0].from;

  if (depth === 0) {
    return { valid: true, depth: 0, rootOwner };
  }

  const verifyBlindSig    = opts?.verifyBlindSig    ?? defaultVerifyBlindSig;
  const verifyOwnerSig    = opts?.verifyOwnerSig    ?? defaultVerifyOwnerSig;
  const verifyTransferKey = opts?.verifyTransferKey ?? defaultVerifyTransferKey;

  for (let i = 0; i < history.length; i++) {
    const record = history[i];

    // ── 1. Chain continuity ─────────────────────────────────────────────────
    if (i > 0) {
      const prev = history[i - 1];
      if (prev.to !== record.from) {
        return {
          valid: false, depth, rootOwner,
          reason: `Broken chain at index ${i}: expected from='${prev.to}', got '${record.from}'`,
        };
      }
      if (prev.toPublicKeyDigest !== record.fromPublicKeyDigest) {
        return {
          valid: false, depth, rootOwner,
          reason: `PKD mismatch at index ${i}: toPublicKeyDigest[${i - 1}] ≠ fromPublicKeyDigest[${i}]`,
        };
      }
    }

    // ── 2. Transfer key lineage ─────────────────────────────────────────────
    if (!verifyTransferKey(record.transferKey, record.fromPublicKeyDigest)) {
      return {
        valid: false, depth, rootOwner,
        reason: `Transfer key does not match prior owner public key at index ${i} (from='${record.from}')`,
      };
    }

    // ── 3. Digest provenance: recompute signedDigest from txBodyHex ─────────
    // This binds all signatures to the actual TX data and prevents grafting:
    // a record with a valid (sig, digest) pair but modified txHex is rejected.
    if (!record.txBodyHex) {
      return {
        valid: false, depth, rootOwner,
        reason: `Missing txBodyHex at transfer index ${i} (from='${record.from}')`,
      };
    }
    let txBodyBytes: Uint8Array;
    try {
      txBodyBytes = hexToBytes(record.txBodyHex);
    } catch {
      return {
        valid: false, depth, rootOwner,
        reason: `Invalid txBodyHex hex at index ${i}`,
      };
    }
    const recomputedDigest = bytesToHex(sha3_256(txBodyBytes));
    if (recomputedDigest !== record.signedDigest) {
      return {
        valid: false, depth, rootOwner,
        reason: `signedDigest mismatch at index ${i}: stored digest does not match sha3_256(txBodyHex) — possible TX data tampering`,
      };
    }

    const commitment = hexToBytes(record.signedDigest);

    // ── 4. SE blind signature ───────────────────────────────────────────────
    if (!verifyBlindSig(record.blindedSignature, commitment, chain.sePublicKey)) {
      return {
        valid: false, depth, rootOwner,
        reason: `Invalid SE blind signature at transfer index ${i} (from='${record.from}' to='${record.to}')`,
      };
    }

    // ── 5. Old-owner signature ──────────────────────────────────────────────
    if (!record.ownerSignature) {
      return {
        valid: false, depth, rootOwner,
        reason: `Missing ownerSignature at transfer index ${i} (from='${record.from}')`,
      };
    }
    if (!verifyOwnerSig(record.ownerSignature, commitment, record.fromPublicKeyDigest)) {
      return {
        valid: false, depth, rootOwner,
        reason: `Invalid owner signature at transfer index ${i} (from='${record.from}')`,
      };
    }
  }

  // ── Final: currentOwner matches last recipient ───────────────────────────
  const last = history[history.length - 1];
  if (last.to !== chain.currentOwner.partyId) {
    return {
      valid: false, depth, rootOwner,
      reason: `currentOwner '${chain.currentOwner.partyId}' does not match last transfer recipient '${last.to}'`,
    };
  }
  if (last.toPublicKeyDigest !== chain.currentOwner.publicKeyDigest) {
    return {
      valid: false, depth, rootOwner,
      reason: `currentOwner PKD mismatch: history '${last.toPublicKeyDigest.slice(0, 8)}…' ≠ state '${chain.currentOwner.publicKeyDigest.slice(0, 8)}…'`,
    };
  }

  return { valid: true, depth, rootOwner };
}
