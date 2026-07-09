/**
 * Minima Wire Format Serializer
 * 
 * High-level serialization for hex-string bundles (used in service.ts).
 * Primitive serialization functions are imported from Streamable.ts.
 * 
 * @deprecated (2026-01) - Most functions deprecated. Use Streamable.ts directly for
 * byte-level serialization. This file remains for HierarchicalWitnessBundle hex APIs.
 */

import {
  concat,
  hexToBytes,
  bytesToHex,
  writeMiniNumber,
  writeMiniData,
  type Bytes,
} from './Streamable.js';

// Re-export primitives for backward compatibility
export { writeMiniNumber as serializeMiniNumber, writeMiniData as serializeMiniData };
export { hexToBytes as fromHex, bytesToHex as toHex };
export type { Bytes };

/**
 * SignatureProof with hex strings (for bundle transport)
 */
export interface SignatureProofHex {
  leafPubkey: string;
  signature: string;
  mmrProof: string;
}

/**
 * HierarchicalWitnessBundle - used by service.ts for transaction signing
 * All fields are hex strings for JSON transport
 */
export interface HierarchicalWitnessBundle {
  addressIndex: number;
  l1: number;
  l2: number;
  rootPublicKey: string;
  proofs: SignatureProofHex[];
}

/**
 * Serialize a SignatureProof from pre-serialized byte arrays
 * 
 * This avoids double-serialization by passing MMR proof bytes through directly.
 * Format matches SignatureProof.writeDataStream():
 *   1. MiniData (publicKey) - 4-byte length + bytes
 *   2. MiniData (signature) - 4-byte length + bytes
 *   3. MMRProof bytes (pre-serialized)
 */
function serializeSignatureProofFromBytes(
  publicKey: Bytes,
  signature: Bytes,
  mmrProofBytes: Bytes
): Bytes {
  return concat(
    writeMiniData(publicKey),
    writeMiniData(signature),
    mmrProofBytes  // Already serialized - pass through directly
  );
}

/**
 * Serialize hierarchical witness bundle to Minima wire format
 * 
 * This converts the HierarchicalWitnessBundle (with hex strings) to
 * the proper Witness signature format matching Witness.java → Signature.java hierarchy.
 * 
 * CRITICAL FIX (2026-01): Must use double-nesting to match Java format:
 *   - Witness.writeDataStream writes: [signatureCount][Signature[0].writeDataStream()]...
 *   - Signature.writeDataStream writes: [proofCount][SignatureProof[0]]...
 * 
 * So the final format is:
 *   [1] = signatureCount (we have 1 Signature object in Witness)
 *   [N] = proofCount inside that Signature (2 for address-based TreeKey)
 *   [SignatureProof[0]]
 *   [SignatureProof[1]]
 * 
 * IMPORTANT: Uses pre-serialized MMR proof bytes directly to avoid
 * double-serialization (deserialize then re-serialize).
 */
export function serializeHierarchicalWitness(bundle: HierarchicalWitnessBundle): Bytes {
  const parts: Bytes[] = [];

  // Witness.signatureCount (MiniNumber) - 1 Signature object containing N proofs
  parts.push(writeMiniNumber(1n));
  
  // Signature.proofCount (MiniNumber) - N SignatureProofs inside the Signature
  parts.push(writeMiniNumber(BigInt(bundle.proofs.length)));

  for (const proofHex of bundle.proofs) {
    const publicKey = hexToBytes(proofHex.leafPubkey);
    const signature = hexToBytes(proofHex.signature);
    const mmrProofBytes = hexToBytes(proofHex.mmrProof);  // Already serialized

    // Serialize SignatureProof with pre-serialized MMR bytes
    parts.push(serializeSignatureProofFromBytes(publicKey, signature, mmrProofBytes));
  }

  return concat(...parts);
}

/**
 * @deprecated (2026-01) This function's output is NOT used in the main Totem transaction flow.
 * MinimaTransactionBuilder.serializeWitness in the extension handles actual witness serialization.
 * Kept for API compatibility and potential future direct SDK usage.
 * 
 * Serialize hierarchical witness bundle to hex string for transport
 */
export function serializeHierarchicalWitnessToHex(bundle: HierarchicalWitnessBundle): string {
  const bytes = serializeHierarchicalWitness(bundle);
  return bytesToHex(bytes);
}
