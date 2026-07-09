// packages/totem-sdk/packages/core/src/mmr.ts
// Full MMR implementation matching Minima's MMR.java, MMRData.java, and TreeKeyNode.java
import { sha3_256 as nobleSha3 } from '@noble/hashes/sha3.js';
import { serializeMiniNumber, serializeMiniData, javaHashAllObjects } from "./javaStreamables.js";
// Import canonical wire serialization from Streamable.ts (single source of truth)
import { writeMMRProof } from "./Streamable.js";
// Re-export for API compatibility (existing code imports from mmr.ts)
// Using a wrapper function for better compatibility with dynamic imports
export function serializeMMRProof(proof, blockTime = 0n) {
    // Convert to Streamable format and serialize
    const streamableProof = {
        blockTime: blockTime,
        chunks: proof.chunks.map(c => ({
            isLeft: c.isLeft,
            mmrData: { data: c.mmrData.data, value: c.mmrData.value }
        }))
    };
    return writeMMRProof(streamableProof);
}
export const serializeRealMMRProof = serializeMMRProof;
/** SHA3-256 helper returning 32 bytes */
function sha3(data) {
    return nobleSha3(data);
}
/** concat utility */
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
/** big-endian u32 */
const u32be = (n) => new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
/**
 * EXACT MiniNumber.ZERO wire format from Java:
 *   scale (1 byte) = 0x00
 *   length (1 byte) = 0x01
 *   unscaled bytes (length=1) = 0x00
 * => 00 01 00
 */
function encodeMiniNumberZERO() {
    return new Uint8Array([0x00, 0x01, 0x00]);
}
/**
 * EXACT MiniString wire format (MiniData of UTF-8):
 *   4-byte big-endian length
 *   raw UTF-8 bytes
 */
function encodeMiniStringUTF8(text) {
    const utf8 = new TextEncoder().encode(text);
    const len = u32be(utf8.length);
    return concat(len, utf8);
}
/**
 * Byte-exact one-leaf MMR leaf used by Minima Address.java path:
 *   sha3( MiniNumber.ZERO || MiniString(script) || MiniNumber.ZERO )
 */
export function mmrLeafExact(script) {
    const zero = encodeMiniNumberZERO();
    const mstr = encodeMiniStringUTF8(script);
    const all = concat(zero, mstr, zero);
    return sha3(all); // 32-byte leaf hash
}
/** In a single-leaf MMR the root equals the leaf commitment. */
export function mmrRootFromSingleLeaf(script) {
    return mmrLeafExact(script);
}
/**
 * Create MMRData leaf node matching Minima's MMRData.CreateMMRDataLeafNode
 *
 * From MMRData.java:
 *   MiniData hash = Crypto.getInstance().hashAllObjects(MiniNumber.ZERO, zData, zSumValue);
 *
 * CRITICAL: Crypto.hashAllObjects uses writeDataStream for Streamables:
 * - MiniNumber: scale + len + data (see serializeMiniNumber)
 * - MiniData: 4-byte length + data (see serializeMiniData)
 *
 * For TreeKeyNode, zData is the Winternitz public key (MiniData) and zSumValue is ZERO
 *
 * Serialization order:
 * 1. MiniNumber.ZERO: [0x00, 0x01, 0x00]
 * 2. MiniData (pubkey): [4-byte length] + [bytes] (writeDataStream, NOT writeHashToStream)
 * 3. MiniNumber.ZERO: [0x00, 0x01, 0x00]
 */
export function createMMRDataLeafNode(pubkey, sumValue = 0n) {
    // Use cached ZERO serialization for efficiency
    const zero = new Uint8Array([0x00, 0x01, 0x00]); // MiniNumber.ZERO
    // IMPORTANT: hashAllObjects uses writeDataStream which is 4-byte length prefixed
    const pubkeySerialized = serializeMiniData(pubkey);
    // For sumValue, serialize as MiniNumber
    let sumSerialized;
    if (sumValue === 0n) {
        sumSerialized = new Uint8Array([0x00, 0x01, 0x00]); // MiniNumber.ZERO
    }
    else {
        sumSerialized = serializeMiniNumber(Number(sumValue));
    }
    const hash = javaHashAllObjects(zero, pubkeySerialized, sumSerialized);
    return { data: hash, value: sumValue };
}
/**
 * Create MMRData parent node matching Minima's MMRData.CreateMMRDataParentNode
 *
 * From MMRData.java:
 *   MiniNumber sumvalue = zLeft.getValue().add(zRight.getValue());
 *   MiniData combinedhash = Crypto.getInstance().hashAllObjects(
 *     MiniNumber.ONE, zLeft.getData(), zRight.getData(), sumvalue);
 *
 * CRITICAL: The getData() returns MiniData (the hash), which is serialized
 * with writeDataStream (4-byte length) in hashAllObjects.
 *
 * Serialization order:
 * 1. MiniNumber.ONE: [0x00, 0x01, 0x01]
 * 2. MiniData (left.data): [4-byte length] + [bytes]
 * 3. MiniData (right.data): [4-byte length] + [bytes]
 * 4. MiniNumber (sumvalue): serialized MiniNumber
 */
export function createMMRDataParentNode(left, right) {
    const sumValue = left.value + right.value;
    // MiniNumber.ONE: [0x00, 0x01, 0x01]
    const one = new Uint8Array([0x00, 0x01, 0x01]);
    // Serialize left and right data as MiniData (4-byte length-prefixed)
    const leftDataSerialized = serializeMiniData(left.data);
    const rightDataSerialized = serializeMiniData(right.data);
    // Serialize sum value
    let sumSerialized;
    if (sumValue === 0n) {
        sumSerialized = new Uint8Array([0x00, 0x01, 0x00]); // MiniNumber.ZERO
    }
    else {
        sumSerialized = serializeMiniNumber(Number(sumValue));
    }
    const hash = javaHashAllObjects(one, leftDataSerialized, rightDataSerialized, sumSerialized);
    return { data: hash, value: sumValue };
}
/**
 * Simple MMR Tree for TreeKeyNode
 * Builds a perfect binary tree from N entries (N must be power of 2 for simplicity)
 *
 * This matches TreeKeyNode.java which always uses 64 leaves (2^6)
 */
export class MMRTree {
    entries = new Map();
    leafCount = 0;
    maxRow = 0;
    getKey(row, entryNumber) {
        return `${row}:${entryNumber}`;
    }
    setEntry(row, entryNumber, data) {
        const entry = { row, entryNumber, mmrData: data };
        this.entries.set(this.getKey(row, entryNumber), entry);
        if (row > this.maxRow)
            this.maxRow = row;
        return entry;
    }
    getEntry(row, entryNumber) {
        return this.entries.get(this.getKey(row, entryNumber));
    }
    /**
     * Add a leaf entry to the MMR
     * Matches MMR.java addEntry() but simplified for power-of-2 trees
     */
    addLeaf(data) {
        const entryNumber = BigInt(this.leafCount);
        const entry = this.setEntry(0, entryNumber, data);
        this.leafCount++;
        // Propagate up the tree
        let current = entry;
        while (current.entryNumber % 2n === 1n) { // Is right child
            const siblingNumber = current.entryNumber - 1n;
            const sibling = this.getEntry(current.row, siblingNumber);
            if (!sibling)
                break;
            // Create parent node
            const parentData = createMMRDataParentNode(sibling.mmrData, current.mmrData);
            const parentRow = current.row + 1;
            const parentEntry = current.entryNumber / 2n;
            current = this.setEntry(parentRow, parentEntry, parentData);
        }
        return entry;
    }
    /**
     * Build tree from array of Winternitz public keys
     * Used by TreeKeyNode to compute wallet public key
     */
    static fromPublicKeys(pubkeys) {
        const tree = new MMRTree();
        for (const pk of pubkeys) {
            const leafData = createMMRDataLeafNode(pk, 0n);
            tree.addLeaf(leafData);
        }
        return tree;
    }
    /**
     * Get the root of the tree
     * For a perfect binary tree with N leaves, root is at row log2(N), entry 0
     */
    getRoot() {
        if (this.leafCount === 0)
            return null;
        // For power of 2 leaves, there's exactly one peak at the top
        const topRow = Math.floor(Math.log2(this.leafCount));
        const root = this.getEntry(topRow, 0n);
        return root?.mmrData || null;
    }
    /**
     * Get proof for a leaf at given index
     * Matches MMR.java getProofToPeak()
     */
    getProof(leafIndex) {
        const chunks = [];
        let row = 0;
        let entryNumber = BigInt(leafIndex);
        // Walk up the tree collecting siblings
        while (row < this.maxRow) {
            const siblingNumber = entryNumber % 2n === 0n
                ? entryNumber + 1n // Current is left, sibling is right
                : entryNumber - 1n; // Current is right, sibling is left
            const sibling = this.getEntry(row, siblingNumber);
            if (!sibling)
                break;
            const isLeft = siblingNumber < entryNumber;
            chunks.push({ isLeft, mmrData: sibling.mmrData });
            // Move to parent
            row++;
            entryNumber = entryNumber / 2n;
        }
        return { chunks };
    }
    /**
     * Get the leaf MMRData at a specific index
     */
    getLeaf(index) {
        const entry = this.getEntry(0, BigInt(index));
        return entry?.mmrData || null;
    }
}
/**
 * Calculate root from leaf data and proof
 * Matches SignatureProof.getRootPublicKey() in Java
 *
 * From SignatureProof.java:
 *   MMRData pubentry = MMRData.CreateMMRDataLeafNode(mPublicKey, MiniNumber.ZERO);
 *   return mProof.calculateProof(pubentry).getData();
 */
export function calculateProofRoot(leafData, proof) {
    let current = leafData;
    for (const chunk of proof.chunks) {
        if (chunk.isLeft) {
            // Sibling is on the left, current is on the right
            current = createMMRDataParentNode(chunk.mmrData, current);
        }
        else {
            // Sibling is on the right, current is on the left
            current = createMMRDataParentNode(current, chunk.mmrData);
        }
    }
    return current.data;
}
/**
 * Verify a proof: check that leaf + proof computes to expected root
 */
export function verifyMMRProof(leafPubkey, proof, expectedRoot) {
    const leafData = createMMRDataLeafNode(leafPubkey, 0n);
    const computedRoot = calculateProofRoot(leafData, proof);
    if (computedRoot.length !== expectedRoot.length)
        return false;
    for (let i = 0; i < computedRoot.length; i++) {
        if (computedRoot[i] !== expectedRoot[i])
            return false;
    }
    return true;
}
// NOTE: serializeMMRProof is now imported from minimaWireSerializer.ts and re-exported above
// This consolidates wire format serialization into a single source of truth.
/**
 * Deserialize MMRProof from bytes matching Minima's MMRProof.readDataStream()
 *
 * Format:
 *   1. blockTime (MiniNumber)
 *   2. chain length (MiniNumber)
 *   3. Each chunk: isLeft (1 byte) + MMRData (hash with 4-byte length prefix + value MiniNumber)
 *
 * CRITICAL: Java MMRData.readDataStream uses mData.readHashFromStream() which reads
 * a 4-byte big-endian length prefix followed by the hash bytes.
 *
 * @returns { proof: MMRProof, blockTime: bigint }
 */
export function parseMMRProofFromHex(data) {
    let offset = 0;
    // Read blockTime as MiniNumber
    const { value: blockTime, bytesRead: btRead } = readMiniNumber(data, offset);
    offset += btRead;
    // Read chain length as MiniNumber
    const { value: numChunks, bytesRead: ncRead } = readMiniNumber(data, offset);
    offset += ncRead;
    const chunks = [];
    for (let i = 0; i < Number(numChunks); i++) {
        // isLeft flag (1 byte)
        const isLeft = data[offset] === 1;
        offset += 1;
        // MMRData: hash (4-byte length prefix + hash bytes) + value (MiniNumber)
        // Read 4-byte big-endian length
        const hashLength = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
        offset += 4;
        const hashData = data.slice(offset, offset + hashLength);
        offset += hashLength;
        const { value: chunkValue, bytesRead: cvRead } = readMiniNumber(data, offset);
        offset += cvRead;
        chunks.push({ isLeft, mmrData: { data: hashData, value: chunkValue } });
    }
    return { proof: { chunks }, blockTime, bytesRead: offset };
}
/**
 * Read a MiniNumber from bytes at the given offset
 * Format: [scale: 1 byte] [length: 1 byte] [data: N bytes]
 */
function readMiniNumber(data, offset) {
    const scale = data[offset];
    const length = data[offset + 1];
    if (length === 0) {
        // Zero value (shouldn't happen with proper serialization)
        return { value: 0n, bytesRead: 2 };
    }
    const dataBytes = data.slice(offset + 2, offset + 2 + length);
    // Convert bytes to bigint
    let value = 0n;
    for (let i = 0; i < dataBytes.length; i++) {
        value = (value << 8n) | BigInt(dataBytes[i]);
    }
    // Apply scale if non-zero (for decimal numbers)
    // For TreeKey MMR, scale is always 0
    return { value, bytesRead: 2 + length };
}
/** @deprecated Use parseMMRProofFromHex */
export const deserializeMMRProof = parseMMRProofFromHex;
