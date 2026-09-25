import { sha3_256 } from '@totemsdk/core';
import {
  hexToBytes,
  bytesToHex,
  deserializeTreeSignature,
  verifyTreeSignatureDetailed,
  verifySignatureDetailed,
  serializeTransaction,
  precomputeTransactionCoinID,
} from '@totemsdk/core';
import { serializeTxPoW } from '@totemsdk/txpow';
import { buildMinimaWitnessBytes } from '@totemsdk/tx-builder';
import { addressToHex, stateVarJson } from './chain.js';
import type { StateChain, SESignature, TransferRecord } from './types.js';

export interface VerifyResult {
  valid: boolean;
  depth: number;
  rootOwner: string;
  reason?: string;
}

/**
 * Verify an old owner's serialized Minima `TreeSignature` over `commitment`.
 *
 * The signer identity is the owner's **root** public key; `verifyTreeSignature`
 * recomputes the root from the proof chain, so a signature can only satisfy
 * `fromPublicKeyDigest` if it actually reconstructs to it.
 */
function verifyOwnerTreeSig(
  ownerSigHex: string,
  commitment: Uint8Array,
  fromRootHex: string,
): boolean {
  try {
    const sig = deserializeTreeSignature(hexToBytes(ownerSigHex));
    return verifyTreeSignatureDetailed(hexToBytes(fromRootHex), commitment, sig).valid === true;
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
 * AUD-012: reconstruct the deterministic transfer tx body and require a
 * byte-exact match, binding `from`/`to` public-key digests to the signed body.
 */
function expectedTransferBody(
  chain: StateChain,
  record: TransferRecord,
  inputCoinId: string,
): Uint8Array | null {
  try {
    const lockAddrHex = addressToHex(chain.lockingAddress);
    const inputCoin = {
      coinid:     inputCoinId,
      address:    lockAddrHex,
      amount:     chain.amount.toString(),
      tokenid:    chain.tokenId,
      storestate: true,
      state:      [stateVarJson(record.fromPublicKeyDigest)],
    };
    const outputCoin = {
      address:    lockAddrHex,
      amount:     chain.amount.toString(),
      tokenid:    chain.tokenId,
      storestate: true,
      state:      [stateVarJson(record.toPublicKeyDigest)],
    };
    return serializeTransaction(JSON.stringify({
      linkhash: '0x00',
      inputs:   [inputCoin],
      outputs:  [outputCoin],
      state:    [],
    }));
  } catch {
    return null;
  }
}

/**
 * AUD-012: reconstruct the TxPoW hex from the signed body + witness and require
 * a match, so a record cannot pair a valid body with an unrelated `txHex`.
 */
function expectedTransferTxHex(
  chain: StateChain,
  record: TransferRecord,
  index: number,
  txBodyBytes: Uint8Array,
  timeMilli: bigint,
): string | null {
  try {
    const ownerSig = deserializeTreeSignature(hexToBytes(record.ownerSignature));
    const seSig = deserializeTreeSignature(hexToBytes(record.seSignature.signature));
    const witnessBytes = buildMinimaWitnessBytes([ownerSig, seSig]);
    const prng = sha3_256(new TextEncoder().encode(`transfer:${chain.chainId}:${index}`));
    return bytesToHex(serializeTxPoW(txBodyBytes, witnessBytes, { prng, timeMilli }));
  } catch {
    return null;
  }
}

/**
 * Verify the full transfer history of a statechain (RFC-009, Minima-faithful).
 *
 * For each TransferRecord, verifies:
 *  1. Chain continuity: party IDs and root public keys are linked hop-by-hop.
 *  2. Digest provenance: sha3_256(txBodyHex) === signedDigest.
 *     Prevents a malicious record from pairing valid signatures over one digest
 *     with unrelated `txHex`. Binds all signatures to the actual TX data.
 *  3. SE signature: verifies the leased-leaf envelope over `signedDigest`
 *     against the SE root's `OwnershipProof` (or the root identity for `root`).
 *  4. Old-owner signature: verifies the root-bound Minima `TreeSignature` over
 *     `signedDigest` against `fromPublicKeyDigest`. Proves the old owner — not
 *     just the SE — authorised this state transition.
 *
 * Then validates that `currentOwner` matches the last transfer recipient.
 */
export function verifyStateChain(chain: StateChain): VerifyResult {
  const history   = chain.transferHistory;
  const depth     = history.length;
  const rootOwner = depth === 0 ? chain.currentOwner.partyId : history[0].from;

  if (depth === 0) {
    return { valid: true, depth: 0, rootOwner };
  }

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

    // ── 2. Digest provenance: recompute signedDigest from txBodyHex ─────────
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

    // ── 2b. Ownership binding (AUD-012) ─────────────────────────────────────
    // The tx body encodes STATE(0) = from/to public-key digests and the spent
    // coin id. Reconstruct it from the record + chain and require an exact
    // match so ownership labels cannot be re-labelled under a valid signature.
    let inputCoinId: string | undefined;
    if (i === 0) {
      inputCoinId = chain.genesisCoinId;
    } else {
      try {
        inputCoinId = bytesToHex(precomputeTransactionCoinID(hexToBytes(history[i - 1].txBodyHex), 0));
      } catch {
        inputCoinId = undefined;
      }
    }
    if (inputCoinId) {
      const expectedBody = expectedTransferBody(chain, record, inputCoinId);
      if (!expectedBody || bytesToHex(expectedBody) !== record.txBodyHex) {
        return {
          valid: false, depth, rootOwner,
          reason: `txBodyHex does not bind ownership at transfer index ${i} (from='${record.from}' to='${record.to}')`,
        };
      }
    }

    // ── 3. SE signature envelope ────────────────────────────────────────────
    if (!record.seSignature) {
      return {
        valid: false, depth, rootOwner,
        reason: `Missing SE signature at transfer index ${i} (from='${record.from}')`,
      };
    }
    if (!verifySeSignatureEnvelope(record.seSignature, commitment, chain)) {
      return {
        valid: false, depth, rootOwner,
        reason: `Invalid SE signature at transfer index ${i} (from='${record.from}' to='${record.to}')`,
      };
    }

    // ── 4. Old-owner TreeSignature ──────────────────────────────────────────
    if (!record.ownerSignature) {
      return {
        valid: false, depth, rootOwner,
        reason: `Missing ownerSignature at transfer index ${i} (from='${record.from}')`,
      };
    }
    if (!verifyOwnerTreeSig(record.ownerSignature, commitment, record.fromPublicKeyDigest)) {
      return {
        valid: false, depth, rootOwner,
        reason: `Invalid owner signature at transfer index ${i} (from='${record.from}')`,
      };
    }

    // ── 5. TxPoW binding (AUD-012) ──────────────────────────────────────────
    if (!record.txHex) {
      return {
        valid: false, depth, rootOwner,
        reason: `Missing txHex at transfer index ${i} (from='${record.from}')`,
      };
    }
    // Legacy records (pre-`txTimeMilli`) have a non-deterministic header time,
    // so the TxPoW binding is only enforced when the timestamp was persisted.
    if (record.txTimeMilli !== undefined) {
      const expectedTxHex = expectedTransferTxHex(chain, record, i, txBodyBytes, BigInt(record.txTimeMilli));
      if (!expectedTxHex || expectedTxHex.toLowerCase() !== record.txHex.toLowerCase()) {
        return {
          valid: false, depth, rootOwner,
          reason: `txHex does not match the signed transfer at index ${i}`,
        };
      }
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
