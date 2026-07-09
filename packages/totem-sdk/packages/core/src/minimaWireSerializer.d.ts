/**
 * Minima Wire Format Serializer
 *
 * Byte-exact serialization matching Minima's Java Signature.java and SignatureProof.java
 *
 * Wire Format Reference:
 *
 * Signature.writeDataStream():
 *   1. MiniNumber - count of SignatureProofs
 *   2. For each SignatureProof.writeDataStream()
 *
 * SignatureProof.writeDataStream():
 *   1. MiniData (publicKey) - 4-byte big-endian length + bytes
 *   2. MiniData (signature) - 4-byte big-endian length + bytes
 *   3. MMRProof.writeDataStream()
 *
 * MMRProof.writeDataStream():
 *   1. MiniNumber (blockTime)
 *   2. MiniNumber (chain length)
 *   3. For each chunk:
 *      - MiniByte (isLeft) - 1 byte (0 or 1)
 *      - MMRData.writeDataStream():
 *        - hash (4-byte length prefix + 32 bytes via writeHashToStream)
 *        - value (MiniNumber)
 *
 * CRITICAL (2026-01): Java's writeHashToStream uses writeInt (4-byte prefix),
 * identical to writeDataStream. See MiniData.java lines 282-289.
 */
export type Bytes = Uint8Array;
/**
 * Serialize MiniNumber matching Java MiniNumber.writeDataStream()
 * Format: [scale: 1 byte] [length: 1 byte] [data: N bytes]
 *
 * Scale is always 0 for integers (no decimal places)
 * Length is 1 byte (NOT 4 bytes like MiniData)
 */
export declare function serializeMiniNumber(value: bigint): Bytes;
/**
 * Serialize MiniData matching Java MiniData.writeDataStream()
 * Format: [4-byte big-endian length] [data bytes]
 */
export declare function serializeMiniData(data: Bytes): Bytes;
/**
 * Write hash with 4-byte length prefix matching Java MiniData.writeHashToStream()
 *
 * From MiniData.java writeHashToStream (lines 282-289):
 *   zOut.writeInt(mData.length);  // 4-byte big-endian int
 *   zOut.write(mData);            // raw bytes
 *
 * CRITICAL: Java uses writeInt (4 bytes), same as writeDataStream!
 * The only difference is a max length check of 64 bytes (MINIMA_MAX_HASH_LENGTH).
 *
 * Used by MMRData.writeDataStream() for the hash field.
 */
export declare function writeHashToStream(hash: Bytes): Bytes;
/**
 * MMRData structure matching Minima's MMRData.java
 */
export interface MMRData {
    data: Bytes;
    value: bigint;
}
/**
 * MMRProofChunk structure matching Minima's MMRProof.MMRProofChunk
 */
export interface MMRProofChunk {
    isLeft: boolean;
    mmrData: MMRData;
}
/**
 * MMRProof structure matching Minima's MMRProof.java
 */
export interface MMRProof {
    chunks: MMRProofChunk[];
}
/**
 * Serialize MMRData matching Java MMRData.writeDataStream()
 *
 * CRITICAL FIX (2026-01): Analysis of coinexport output shows MMRData uses
 * MiniData format (4-byte length prefix + 32 bytes) for the hash field,
 * NOT raw 32 bytes. This matches what Minima's node produces.
 *
 * Format:
 *   - hash (MiniData: 4-byte length + 32 bytes)
 *   - value (MiniNumber)
 */
export declare function serializeMMRData(mmrData: MMRData): Bytes;
/**
 * Serialize MMRProof matching Java MMRProof.writeDataStream()
 *
 * Format:
 *   1. MiniNumber (blockTime) - always 0 for TreeKey proofs
 *   2. MiniNumber (chain length)
 *   3. For each chunk:
 *      - MiniByte (isLeft) - 1 byte
 *      - MMRData (hash + value)
 */
export declare function serializeMMRProof(proof: MMRProof, blockTime?: bigint): Bytes;
/**
 * SignatureProof structure matching Minima's SignatureProof.java
 */
export interface SignatureProof {
    publicKey: Bytes;
    signature: Bytes;
    proof: MMRProof;
}
/**
 * Serialize SignatureProof matching Java SignatureProof.writeDataStream()
 *
 * Format:
 *   1. MiniData (publicKey) - 4-byte length + bytes
 *   2. MiniData (signature) - 4-byte length + bytes
 *   3. MMRProof.writeDataStream()
 */
export declare function serializeSignatureProof(sigProof: SignatureProof): Bytes;
/**
 * Signature structure matching Minima's Signature.java
 */
export interface Signature {
    proofs: SignatureProof[];
}
/**
 * Serialize Signature matching Java Signature.writeDataStream()
 *
 * Format:
 *   1. MiniNumber - count of SignatureProofs
 *   2. For each SignatureProof.writeDataStream()
 *
 * From Signature.java:
 *   MiniNumber.WriteToStream(zOut, mSignatures.size());
 *   for(SignatureProof sig : mSignatures) {
 *       sig.writeDataStream(zOut);
 *   }
 */
export declare function serializeSignature(signature: Signature): Bytes;
/**
 * Convert hex string to bytes
 */
export declare function fromHex(hex: string): Bytes;
/**
 * Convert bytes to hex string with 0x prefix
 */
export declare function toHex(bytes: Bytes): string;
/**
 * Convert SignatureProofHex format (from TransactionService) to wire format bytes
 *
 * This is the main entry point for serializing hierarchical TreeKey signatures
 * for txnimport.
 */
export interface SignatureProofHex {
    leafPubkey: string;
    signature: string;
    mmrProof: string;
}
export interface HierarchicalWitnessBundle {
    addressIndex: number;
    l1: number;
    l2: number;
    rootPublicKey: string;
    proofs: SignatureProofHex[];
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
export declare function serializeHierarchicalWitness(bundle: HierarchicalWitnessBundle): Bytes;
/**
 * @deprecated (2026-01) This function's output is NOT used in the main Totem transaction flow.
 * MinimaTransactionBuilder.serializeWitness in the extension handles actual witness serialization.
 * Kept for API compatibility and potential future direct SDK usage.
 *
 * Serialize hierarchical witness bundle to hex string for transport
 */
export declare function serializeHierarchicalWitnessToHex(bundle: HierarchicalWitnessBundle): string;
