"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeMiniNumber = serializeMiniNumber;
exports.serializeMiniData = serializeMiniData;
exports.writeHashToStream = writeHashToStream;
exports.serializeMMRData = serializeMMRData;
exports.serializeMMRProof = serializeMMRProof;
exports.serializeSignatureProof = serializeSignatureProof;
exports.serializeSignature = serializeSignature;
exports.fromHex = fromHex;
exports.toHex = toHex;
exports.serializeHierarchicalWitness = serializeHierarchicalWitness;
exports.serializeHierarchicalWitnessToHex = serializeHierarchicalWitnessToHex;
function concat(...parts) {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
        out.set(p, off);
        off += p.length;
    }
    return out;
}
/**
 * Serialize MiniNumber matching Java MiniNumber.writeDataStream()
 * Format: [scale: 1 byte] [length: 1 byte] [data: N bytes]
 *
 * Scale is always 0 for integers (no decimal places)
 * Length is 1 byte (NOT 4 bytes like MiniData)
 */
function serializeMiniNumber(value) {
    const scale = 0;
    if (value === 0n) {
        return new Uint8Array([scale, 1, 0x00]);
    }
    if (value < 0n) {
        throw new Error(`Negative values not supported: ${value}`);
    }
    let hex = value.toString(16);
    if (hex.length % 2 !== 0)
        hex = '0' + hex;
    const dataBytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < dataBytes.length; i++) {
        dataBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    let finalBytes = dataBytes;
    if (dataBytes.length > 0 && (dataBytes[0] & 0x80) !== 0) {
        finalBytes = new Uint8Array(dataBytes.length + 1);
        finalBytes[0] = 0x00;
        finalBytes.set(dataBytes, 1);
    }
    const result = new Uint8Array(1 + 1 + finalBytes.length);
    result[0] = scale;
    result[1] = finalBytes.length;
    result.set(finalBytes, 2);
    return result;
}
/**
 * Serialize MiniData matching Java MiniData.writeDataStream()
 * Format: [4-byte big-endian length] [data bytes]
 */
function serializeMiniData(data) {
    const length = data.length;
    const result = new Uint8Array(4 + length);
    result[0] = (length >> 24) & 0xff;
    result[1] = (length >> 16) & 0xff;
    result[2] = (length >> 8) & 0xff;
    result[3] = length & 0xff;
    result.set(data, 4);
    return result;
}
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
function writeHashToStream(hash) {
    if (hash.length > 64) {
        throw new Error(`Hash too long for writeHashToStream: ${hash.length} bytes (max 64)`);
    }
    const result = new Uint8Array(4 + hash.length);
    result[0] = (hash.length >> 24) & 0xff;
    result[1] = (hash.length >> 16) & 0xff;
    result[2] = (hash.length >> 8) & 0xff;
    result[3] = hash.length & 0xff;
    result.set(hash, 4);
    return result;
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
function serializeMMRData(mmrData) {
    return concat(serializeMiniData(mmrData.data), // MiniData format with 4-byte length prefix
    serializeMiniNumber(mmrData.value));
}
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
function serializeMMRProof(proof, blockTime = 0n) {
    const parts = [];
    parts.push(serializeMiniNumber(blockTime));
    parts.push(serializeMiniNumber(BigInt(proof.chunks.length)));
    for (const chunk of proof.chunks) {
        parts.push(new Uint8Array([chunk.isLeft ? 1 : 0]));
        parts.push(serializeMMRData(chunk.mmrData));
    }
    return concat(...parts);
}
/**
 * Serialize SignatureProof matching Java SignatureProof.writeDataStream()
 *
 * Format:
 *   1. MiniData (publicKey) - 4-byte length + bytes
 *   2. MiniData (signature) - 4-byte length + bytes
 *   3. MMRProof.writeDataStream()
 */
function serializeSignatureProof(sigProof) {
    return concat(serializeMiniData(sigProof.publicKey), serializeMiniData(sigProof.signature), serializeMMRProof(sigProof.proof));
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
function serializeSignature(signature) {
    const parts = [];
    parts.push(serializeMiniNumber(BigInt(signature.proofs.length)));
    for (const proof of signature.proofs) {
        parts.push(serializeSignatureProof(proof));
    }
    return concat(...parts);
}
/**
 * Convert hex string to bytes
 */
function fromHex(hex) {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (cleanHex.length % 2 !== 0) {
        throw new Error('Invalid hex string length');
    }
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}
/**
 * Convert bytes to hex string with 0x prefix
 */
function toHex(bytes) {
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
/**
 * @deprecated Deserialize MMRProof from bytes - unused, kept for reference only
 *
 * This was used in the double-serialization path which has been removed.
 * The correct approach is to pass pre-serialized bytes through directly.
 *
 * CRITICAL: Java MMRData.readDataStream uses mData.readHashFromStream() which reads
 * a 4-byte big-endian length prefix followed by the hash bytes.
 */
function deserializeMMRProofFromBytes(data) {
    let offset = 0;
    const { value: blockTime, bytesRead: btRead } = readMiniNumber(data, offset);
    offset += btRead;
    const { value: numChunks, bytesRead: ncRead } = readMiniNumber(data, offset);
    offset += ncRead;
    const chunks = [];
    for (let i = 0; i < Number(numChunks); i++) {
        const isLeft = data[offset] === 1;
        offset += 1;
        // Read 4-byte big-endian length prefix for hash (writeHashToStream format)
        const hashLength = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
        offset += 4;
        const hashData = data.slice(offset, offset + hashLength);
        offset += hashLength;
        const { value: chunkValue, bytesRead: cvRead } = readMiniNumber(data, offset);
        offset += cvRead;
        chunks.push({ isLeft, mmrData: { data: hashData, value: chunkValue } });
    }
    return { chunks };
}
function readMiniNumber(data, offset) {
    const scale = data[offset];
    const length = data[offset + 1];
    if (length === 0) {
        return { value: 0n, bytesRead: 2 };
    }
    const dataBytes = data.slice(offset + 2, offset + 2 + length);
    let value = 0n;
    for (const b of dataBytes) {
        value = (value << 8n) | BigInt(b);
    }
    return { value, bytesRead: 2 + length };
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
function serializeSignatureProofFromBytes(publicKey, signature, mmrProofBytes) {
    return concat(serializeMiniData(publicKey), serializeMiniData(signature), mmrProofBytes // Already serialized - pass through directly
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
function serializeHierarchicalWitness(bundle) {
    const parts = [];
    // Witness.signatureCount (MiniNumber) - 1 Signature object containing N proofs
    parts.push(serializeMiniNumber(1n));
    // Signature.proofCount (MiniNumber) - N SignatureProofs inside the Signature
    parts.push(serializeMiniNumber(BigInt(bundle.proofs.length)));
    for (const proofHex of bundle.proofs) {
        const publicKey = fromHex(proofHex.leafPubkey);
        const signature = fromHex(proofHex.signature);
        const mmrProofBytes = fromHex(proofHex.mmrProof); // Already serialized
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
function serializeHierarchicalWitnessToHex(bundle) {
    const bytes = serializeHierarchicalWitness(bundle);
    return toHex(bytes);
}
