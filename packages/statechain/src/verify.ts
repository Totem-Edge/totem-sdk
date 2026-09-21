import { sha3_256 } from '@totemsdk/core';
import { hexToBytes, wotsVerifyDigest, derivePKdigest, bytesToHex, verifySignatureDetailed } from '@totemsdk/core';
import type { StateChain, SESignature } from './types.js';

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
 * RFC-008: verify an SE signature envelope (leased one-time leaf).
 *
 *  - `child` (transfer blind-signature): the leaf public key/address must be a
 *    member of the SE root's published `OwnershipProof`, and the one-time
 *    `TreeSignature` must verify over the commitment.
 *  - `root` (claim co-signature): the signing key must be the published root
 *    identity (`chain.sePublicKey`).
 *
 * The root proof itself is pinned/verified once when the SE identity is
 * established; per transfer we enforce leaf authorization + the signature.
 */
export function verifySeSignatureEnvelope(
  envelope: SESignature,
  commitment: Uint8Array,
  chain: StateChain,
): boolean {
  const message = bytesToHex(commitment);
  if (envelope.message !== message) return false;

  if (envelope.kind === 'root') {
    if (!chain.sePublicKey) return false;
    if (envelope.publicKey.toLowerCase() !== chain.sePublicKey.toLowerCase()) return false;
  } else {
    const proof = chain.seOwnershipProof;
    if (!proof) return false;
    const leafKey = envelope.publicKey.toLowerCase();
    const leafAddr = envelope.address.toLowerCase();
    if (!proof.childPublicKeys.some((k) => k.toLowerCase() === leafKey)) return false;
    if (!proof.childAddresses.some((a) => a.toLowerCase() === leafAddr)) return false;
  }

  try {
    return verifySignatureDetailed(
      envelope.address,
      message,
      envelope.signature,
      envelope.publicKey,
    ).valid === true;
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

    // ── 4. SE signature ─────────────────────────────────────────────────────
    // RFC-008: prefer the leased-leaf envelope (authorization + one-time sig);
    // fall back to the legacy fixed-key check for string-only clients.
    const seOk = record.seSignature
      ? verifySeSignatureEnvelope(record.seSignature, commitment, chain)
      : verifyBlindSig(record.blindedSignature, commitment, chain.sePublicKey);
    if (!seOk) {
      return {
        valid: false, depth, rootOwner,
        reason: `Invalid SE signature at transfer index ${i} (from='${record.from}' to='${record.to}')`,
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
