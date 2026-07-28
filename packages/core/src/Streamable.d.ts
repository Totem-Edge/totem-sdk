/**
 * Streamable.ts - Canonical Java-Compatible Serialization Primitives
 *
 * This module provides byte-exact serialization functions matching
 * Minima's Java Streamable interface and its implementations.
 *
 * JAVA REFERENCE CLASSES:
 *   - MiniData.writeDataStream(): 4-byte int length + raw bytes
 *   - MiniNumber.writeDataStream(): 1-byte scale + 1-byte len + BigInteger bytes
 *   - MiniString.writeDataStream(): delegates to MiniData(UTF-8 bytes)
 *   - MiniByte.writeDataStream(): single byte
 *   - Crypto.writeHashToStream(): 4-byte int length + hash bytes
 *   - MMREntryNumber.writeDataStream(): 1-byte len + BigInteger bytes
 *
 * CRITICAL NOTES:
 *   - MiniNumber uses 1-byte length, NOT 4-byte like MiniData
 *   - BigInteger.toByteArray() uses two's complement (leading 0 if high bit set)
 *   - Zero encodes as length=1, value=0x00
 *
 * Created: 2026-01-20
 * Purpose: Single source of truth for all Minima type serialization
 */
export type Bytes = Uint8Array;
export declare function hexToBytes(hex: string): Uint8Array;
export declare function bytesToHex(bytes: Uint8Array): string;
export declare function concat(...arrays: Uint8Array[]): Uint8Array;
/**
 * Encode a MiniByte per Java MiniByte.writeDataStream()
 *
 * Format: single byte (0-255)
 */
export declare function writeMiniByte(value: number | boolean): Uint8Array;
/**
 * Encode a MiniData per Java MiniData.writeDataStream()
 *
 * Format: 4-byte big-endian int length + raw bytes
 */
export declare function writeMiniData(data: Uint8Array): Uint8Array;
/**
 * Encode a MiniString per Java MiniString.writeDataStream()
 *
 * Format: MiniData encoding of UTF-8 bytes
 *         = 4-byte int length + UTF-8 bytes
 */
export declare function writeMiniString(str: string): Uint8Array;
/**
 * Convert a BigInt to Java BigInteger.toByteArray() format.
 *
 * Java BigInteger uses two's complement:
 *   - Zero → [0x00]
 *   - Positive with high bit set → leading 0x00 byte
 *
 * @param value - The BigInt value (must be non-negative)
 * @returns Uint8Array in two's complement format
 */
export declare function bigIntToByteArray(value: bigint): Uint8Array;
/**
 * Encode a MiniNumber per Java MiniNumber.writeDataStream()
 *
 * Format:
 *   1 byte: scale (number of decimal places, signed)
 *   1 byte: length of unscaled BigInteger data
 *   N bytes: unscaled BigInteger in two's complement
 *
 * CRITICAL: Uses 1-byte length, NOT 4-byte like MiniData!
 *
 * @param value - The unscaled BigInt value
 * @param scale - The scale (decimal places), default 0
 */
export declare function writeMiniNumber(value: bigint, scale?: number): Uint8Array;
/**
 * Encode a hash per Java Crypto.writeHashToStream()
 *
 * Format: 4-byte big-endian int length + hash bytes
 *         (Same as MiniData)
 */
export declare function writeHashToStream(hash: Uint8Array): Uint8Array;
/**
 * Encode an MMREntryNumber per Java MMREntryNumber.writeDataStream()
 *
 * Java source (MMREntryNumber.java):
 *   MiniNumber.WriteToStream(zOut, mNumber.scale());   // scale as MiniNumber
 *   MiniData.WriteToStream(zOut, mNumber.unscaledValue().toByteArray()); // unscaled as MiniData
 *
 * Format:
 *   - MiniNumber for scale (always 0 for integer values)
 *   - MiniData for unscaled BigInteger value
 *
 * For integer MMREntryNumber (scale=0), this encodes as:
 *   [00 01 00]        - MiniNumber: scale=0, len=1, data=0x00
 *   [00 00 00 LL ...] - MiniData: 4-byte len + BigInteger bytes
 */
export declare function writeMMREntryNumber(value: bigint, scale?: number): Uint8Array;
/**
 * StateVariable type constants from Java StateVariable.java
 */
export declare const STATETYPE_HEX = 1;
export declare const STATETYPE_NUMBER = 2;
export declare const STATETYPE_STRING = 4;
export declare const STATETYPE_BOOL = 8;
/**
 * High-level StateVariable value type
 */
export interface StateVariableValue {
    port: number;
    value: string | bigint | boolean | Uint8Array;
    type: 'bool' | 'number' | 'hex' | 'string';
}
/**
 * Normalize hex/address string to 0x format.
 * Handles both Mx (Minima Base32) and 0x formats.
 * Matches Java's StateVariable constructor behavior.
 *
 * Note: For Mx conversion, caller should use mxToHex from minima-base32
 * This function handles 0x prefix normalization only.
 */
export declare function normalizeHexString(value: string): string;
/**
 * Serialize a StateVariable per Java StateVariable.writeDataStream()
 *
 * Format:
 *   1. port (MiniByte - 1 byte, 0-255)
 *   2. type (MiniByte - 1 byte: HEX=1, NUMBER=2, STRING=4, BOOL=8)
 *   3. data (format depends on type):
 *      - BOOL: MiniByte (1 byte: 0 or 1)
 *      - HEX: MiniData (4-byte length + hex bytes)
 *      - NUMBER: MiniNumber (1-byte scale + 1-byte len + data)
 *      - STRING: MiniString (4-byte length + UTF-8 with brackets)
 *
 * @param sv - StateVariable with high-level value
 * @param mxToHex - Optional function to convert Mx addresses to 0x hex
 */
export declare function writeStateVariable(sv: StateVariableValue, mxToHex?: (addr: string) => string): Uint8Array;
/**
 * MMRData interface matching Java MMRData structure
 */
export interface MMRData {
    data: Uint8Array;
    value: bigint;
}
/**
 * Write MMRData per Java MMRData.writeDataStream()
 *
 * Java source (MMRData.java):
 *   mData.writeHashToStream(zOut);  // 4-byte len + hash
 *   mValue.writeDataStream(zOut);   // MiniNumber
 */
export declare function writeMMRData(mmrData: MMRData): Uint8Array;
/**
 * MMRProofChunk interface matching Java MMRProofChunk structure
 */
export interface MMRProofChunk {
    isLeft: boolean;
    mmrData: MMRData;
}
/**
 * Write MMRProofChunk per Java MMRProofChunk.writeDataStream()
 *
 * Java source (MMRProof.java inner class):
 *   mLeft.writeDataStream(zOut);    // MiniByte (1 byte)
 *   mMMRData.writeDataStream(zOut); // MMRData
 */
export declare function writeMMRProofChunk(chunk: MMRProofChunk): Uint8Array;
/**
 * MMRProof interface matching Java MMRProof structure
 */
export interface MMRProof {
    blockTime: bigint;
    chunks: MMRProofChunk[];
}
/**
 * Write MMRProof per Java MMRProof.writeDataStream()
 *
 * Java source (MMRProof.java):
 *   mBlockTime.writeDataStream(zOut);           // MiniNumber
 *   MiniNumber.WriteToStream(zOut, len);        // Array length as MiniNumber
 *   for each chunk: chunk.writeDataStream(zOut);
 */
export declare function writeMMRProof(proof: MMRProof): Uint8Array;
/**
 * SignatureProof interface matching Java SignatureProof structure
 *
 * CRITICAL FIX (January 2026): Java's Winternitz.getPublicKey() returns a 32-byte DIGEST!
 * BouncyCastle's WinternitzOTSignature.getPublicKey() hashes the full 1088-byte key
 * and returns SHA3-256(full_key) = 32 bytes. The MMR tree and SignatureProof use this digest.
 */
export interface SignatureProof {
    leafPubkey: Uint8Array;
    signature: Uint8Array;
    mmrProof: MMRProof;
}
/**
 * Write SignatureProof per Java SignatureProof.writeDataStream()
 *
 * Java source (SignatureProof.java):
 *   mPublicKey.writeDataStream(zOut);  // MiniData
 *   mSignature.writeDataStream(zOut);  // MiniData
 *   mProof.writeDataStream(zOut);      // MMRProof
 */
export declare function writeSignatureProof(sigProof: SignatureProof): Uint8Array;
/**
 * Signature interface matching Java Signature structure
 * A Signature contains an array of SignatureProofs (for hierarchical signing)
 */
export interface Signature {
    proofs: SignatureProof[];
}
/**
 * Write Signature per Java Signature.writeDataStream()
 *
 * Java source (Signature.java):
 *   MiniNumber.WriteToStream(zOut, mSignatures.size());
 *   for each sig: sig.writeDataStream(zOut);
 */
export declare function writeSignature(sig: Signature): Uint8Array;
/**
 * CoinProof interface (simplified - coin proofs in witness)
 * Full implementation would include coin data + MMR proof
 */
export interface CoinProof {
    data: Uint8Array;
}
/**
 * ScriptProof interface (simplified - script proofs in witness)
 */
export interface ScriptProof {
    data: Uint8Array;
}
/**
 * Witness interface matching Java Witness structure
 * Used for full transaction witness serialization
 */
export interface Witness {
    signatures: Signature[];
    coinProofs: CoinProof[];
    scriptProofs: ScriptProof[];
}
/**
 * Write Witness per Java Witness.writeDataStream()
 *
 * Java source (Witness.java):
 *   MiniNumber.WriteToStream(zOut, mSignatureProofs.size());
 *   for each sp: sp.writeDataStream(zOut);
 *   MiniNumber.WriteToStream(zOut, mCoinProofs.size());
 *   for each cp: cp.writeDataStream(zOut);
 *   MiniNumber.WriteToStream(zOut, mScriptProofs.size());
 *   for each sp: sp.writeDataStream(zOut);
 */
export declare function writeWitness(witness: Witness): Uint8Array;
/**
 * HierarchicalWitnessBundle - Simplified witness for WOTS hierarchical signing
 * This is the format used by Totem for transaction signing
 */
export interface HierarchicalWitnessBundle {
    signatures: Signature[];
}
/**
 * Write a simplified hierarchical witness (signatures only)
 * Used for WOTS transaction signing flow
 */
export declare function writeHierarchicalWitness(bundle: HierarchicalWitnessBundle): Uint8Array;
/**
 * Write hierarchical witness and return as hex string
 */
export declare function writeHierarchicalWitnessToHex(bundle: HierarchicalWitnessBundle): string;
export declare const encodeMiniNumber: typeof writeMiniNumber;
export declare const encodeMiniData: typeof writeMiniData;
export declare const encodeMiniString: typeof writeMiniString;
