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
export function hexToBytes(hex) {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (cleanHex.length === 0) {
        return new Uint8Array(0);
    }
    if (cleanHex.length % 2 !== 0) {
        throw new Error(`Invalid hex string: odd length (${cleanHex.length})`);
    }
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
    }
    return bytes;
}
export function bytesToHex(bytes) {
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
export function concat(...arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}
/**
 * Encode a MiniByte per Java MiniByte.writeDataStream()
 *
 * Format: single byte (0-255)
 */
export function writeMiniByte(value) {
    if (typeof value === 'boolean') {
        return new Uint8Array([value ? 1 : 0]);
    }
    if (value < 0 || value > 255) {
        throw new Error(`MiniByte value must be 0-255, got ${value}`);
    }
    return new Uint8Array([value & 0xff]);
}
/**
 * Encode a MiniData per Java MiniData.writeDataStream()
 *
 * Format: 4-byte big-endian int length + raw bytes
 */
export function writeMiniData(data) {
    const length = data.length;
    const lengthBytes = new Uint8Array([
        (length >> 24) & 0xff,
        (length >> 16) & 0xff,
        (length >> 8) & 0xff,
        length & 0xff
    ]);
    return concat(lengthBytes, data);
}
/**
 * Encode a MiniString per Java MiniString.writeDataStream()
 *
 * Format: MiniData encoding of UTF-8 bytes
 *         = 4-byte int length + UTF-8 bytes
 */
export function writeMiniString(str) {
    const utf8Bytes = new TextEncoder().encode(str);
    return writeMiniData(utf8Bytes);
}
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
export function bigIntToByteArray(value) {
    if (value < 0n) {
        throw new Error(`bigIntToByteArray does not support negative values: ${value}`);
    }
    if (value === 0n) {
        return new Uint8Array([0]);
    }
    let hex = value.toString(16);
    if (hex.length % 2 !== 0) {
        hex = '0' + hex;
    }
    let bytes = hexToBytes('0x' + hex);
    if (bytes.length > 0 && (bytes[0] & 0x80) !== 0) {
        const withLeadingZero = new Uint8Array(bytes.length + 1);
        withLeadingZero[0] = 0x00;
        withLeadingZero.set(bytes, 1);
        bytes = withLeadingZero;
    }
    return bytes;
}
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
export function writeMiniNumber(value, scale = 0) {
    if (typeof value !== 'bigint') {
        throw new Error(`writeMiniNumber requires bigint, got ${typeof value}`);
    }
    if (value < 0n) {
        throw new Error(`writeMiniNumber does not support negative values: ${value}`);
    }
    const unscaledBytes = bigIntToByteArray(value);
    const length = unscaledBytes.length;
    if (length > 255) {
        throw new Error(`MiniNumber data too large: ${length} bytes (max 255)`);
    }
    const result = new Uint8Array(1 + 1 + length);
    result[0] = scale & 0xff;
    result[1] = length & 0xff;
    result.set(unscaledBytes, 2);
    return result;
}
/**
 * Encode a hash per Java Crypto.writeHashToStream()
 *
 * Format: 4-byte big-endian int length + hash bytes
 *         (Same as MiniData)
 */
export function writeHashToStream(hash) {
    return writeMiniData(hash);
}
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
export function writeMMREntryNumber(value, scale = 0) {
    if (value < 0n) {
        throw new Error(`writeMMREntryNumber does not support negative values: ${value}`);
    }
    // Write scale as MiniNumber (scale of scale is always 0)
    const scaleBytes = writeMiniNumber(BigInt(scale), 0);
    // Write unscaled value as MiniData
    const unscaledBytes = bigIntToByteArray(value);
    const unscaledData = writeMiniData(unscaledBytes);
    return concat(scaleBytes, unscaledData);
}
/**
 * StateVariable type constants from Java StateVariable.java
 */
export const STATETYPE_HEX = 1;
export const STATETYPE_NUMBER = 2;
export const STATETYPE_STRING = 4;
export const STATETYPE_BOOL = 8;
/**
 * Normalize hex/address string to 0x format.
 * Handles both Mx (Minima Base32) and 0x formats.
 * Matches Java's StateVariable constructor behavior.
 *
 * Note: For Mx conversion, caller should use mxToHex from minima-base32
 * This function handles 0x prefix normalization only.
 */
export function normalizeHexString(value) {
    if (!value) {
        return '0x00';
    }
    const trimmed = value.trim();
    return trimmed.startsWith('0x') ? trimmed : '0x' + trimmed;
}
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
export function writeStateVariable(sv, mxToHex) {
    if (sv.port < 0 || sv.port > 255) {
        throw new Error(`StateVariable port must be 0-255, got ${sv.port}`);
    }
    const portByte = writeMiniByte(sv.port);
    let typeByte;
    let dataBytes;
    switch (sv.type) {
        case 'bool':
            typeByte = writeMiniByte(STATETYPE_BOOL);
            if (typeof sv.value === 'boolean') {
                dataBytes = writeMiniByte(sv.value);
            }
            else if (typeof sv.value === 'string') {
                dataBytes = writeMiniByte(sv.value.toUpperCase() === 'TRUE');
            }
            else {
                throw new Error(`Invalid bool StateVariable value: ${sv.value}`);
            }
            break;
        case 'number':
            typeByte = writeMiniByte(STATETYPE_NUMBER);
            if (typeof sv.value === 'bigint') {
                dataBytes = writeMiniNumber(sv.value);
            }
            else if (typeof sv.value === 'string') {
                dataBytes = writeMiniNumber(BigInt(sv.value));
            }
            else {
                throw new Error(`Invalid number StateVariable value: ${sv.value}`);
            }
            break;
        case 'hex':
            typeByte = writeMiniByte(STATETYPE_HEX);
            if (typeof sv.value === 'string') {
                let normalizedHex = sv.value;
                if (sv.value.toLowerCase().startsWith('mx') && mxToHex) {
                    normalizedHex = mxToHex(sv.value);
                }
                else {
                    normalizedHex = normalizeHexString(sv.value);
                }
                dataBytes = writeMiniData(hexToBytes(normalizedHex));
            }
            else if (sv.value instanceof Uint8Array) {
                dataBytes = writeMiniData(sv.value);
            }
            else {
                throw new Error(`Invalid hex StateVariable value: ${sv.value}`);
            }
            break;
        case 'string':
            typeByte = writeMiniByte(STATETYPE_STRING);
            if (typeof sv.value === 'string') {
                let bracketedValue = sv.value;
                if (!sv.value.startsWith('[') || !sv.value.endsWith(']')) {
                    bracketedValue = `[${sv.value}]`;
                }
                dataBytes = writeMiniString(bracketedValue);
            }
            else {
                throw new Error(`Invalid string StateVariable value: ${sv.value}`);
            }
            break;
        default:
            throw new Error(`Unknown StateVariable type: ${sv.type}`);
    }
    return concat(portByte, typeByte, dataBytes);
}
/**
 * Write MMRData per Java MMRData.writeDataStream()
 *
 * Java source (MMRData.java):
 *   mData.writeHashToStream(zOut);  // 4-byte len + hash
 *   mValue.writeDataStream(zOut);   // MiniNumber
 */
export function writeMMRData(mmrData) {
    const hashBytes = writeHashToStream(mmrData.data);
    const valueBytes = writeMiniNumber(mmrData.value, 0);
    return concat(hashBytes, valueBytes);
}
/**
 * Write MMRProofChunk per Java MMRProofChunk.writeDataStream()
 *
 * Java source (MMRProof.java inner class):
 *   mLeft.writeDataStream(zOut);    // MiniByte (1 byte)
 *   mMMRData.writeDataStream(zOut); // MMRData
 */
export function writeMMRProofChunk(chunk) {
    const leftByte = writeMiniByte(chunk.isLeft);
    const dataBytes = writeMMRData(chunk.mmrData);
    return concat(leftByte, dataBytes);
}
/**
 * Write MMRProof per Java MMRProof.writeDataStream()
 *
 * Java source (MMRProof.java):
 *   mBlockTime.writeDataStream(zOut);           // MiniNumber
 *   MiniNumber.WriteToStream(zOut, len);        // Array length as MiniNumber
 *   for each chunk: chunk.writeDataStream(zOut);
 */
export function writeMMRProof(proof) {
    const blockTimeBytes = writeMiniNumber(proof.blockTime, 0);
    const lengthBytes = writeMiniNumber(BigInt(proof.chunks.length), 0);
    const parts = [blockTimeBytes, lengthBytes];
    for (const chunk of proof.chunks) {
        parts.push(writeMMRProofChunk(chunk));
    }
    return concat(...parts);
}
/**
 * Write SignatureProof per Java SignatureProof.writeDataStream()
 *
 * Java source (SignatureProof.java):
 *   mPublicKey.writeDataStream(zOut);  // MiniData
 *   mSignature.writeDataStream(zOut);  // MiniData
 *   mProof.writeDataStream(zOut);      // MMRProof
 */
export function writeSignatureProof(sigProof) {
    const pubKeyBytes = writeMiniData(sigProof.leafPubkey);
    const sigBytes = writeMiniData(sigProof.signature);
    const proofBytes = writeMMRProof(sigProof.mmrProof);
    return concat(pubKeyBytes, sigBytes, proofBytes);
}
/**
 * Write Signature per Java Signature.writeDataStream()
 *
 * Java source (Signature.java):
 *   MiniNumber.WriteToStream(zOut, mSignatures.size());
 *   for each sig: sig.writeDataStream(zOut);
 */
export function writeSignature(sig) {
    const lengthBytes = writeMiniNumber(BigInt(sig.proofs.length), 0);
    const parts = [lengthBytes];
    for (const proof of sig.proofs) {
        parts.push(writeSignatureProof(proof));
    }
    return concat(...parts);
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
export function writeWitness(witness) {
    const parts = [];
    // Signatures
    parts.push(writeMiniNumber(BigInt(witness.signatures.length), 0));
    for (const sig of witness.signatures) {
        parts.push(writeSignature(sig));
    }
    // Coin proofs
    parts.push(writeMiniNumber(BigInt(witness.coinProofs.length), 0));
    for (const cp of witness.coinProofs) {
        parts.push(cp.data);
    }
    // Script proofs
    parts.push(writeMiniNumber(BigInt(witness.scriptProofs.length), 0));
    for (const sp of witness.scriptProofs) {
        parts.push(sp.data);
    }
    return concat(...parts);
}
/**
 * Write a simplified hierarchical witness (signatures only)
 * Used for WOTS transaction signing flow
 */
export function writeHierarchicalWitness(bundle) {
    const lengthBytes = writeMiniNumber(BigInt(bundle.signatures.length), 0);
    const parts = [lengthBytes];
    for (const sig of bundle.signatures) {
        parts.push(writeSignature(sig));
    }
    return concat(...parts);
}
/**
 * Write hierarchical witness and return as hex string
 */
export function writeHierarchicalWitnessToHex(bundle) {
    return bytesToHex(writeHierarchicalWitness(bundle));
}
// ============================================================
// EXTENSION-MATCHING ALIASES
// ============================================================
// The extension's WitnessSerializer uses encode* naming, while SDK uses write* naming.
// These aliases provide compatibility with extension code.
export const encodeMiniNumber = writeMiniNumber;
export const encodeMiniData = writeMiniData;
export const encodeMiniString = writeMiniString;
