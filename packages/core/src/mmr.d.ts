export declare function serializeMMRProof(proof: {
    chunks: Array<{
        isLeft: boolean;
        mmrData: {
            data: Bytes;
            value: bigint;
        };
    }>;
}, blockTime?: bigint): Bytes;
export declare const serializeRealMMRProof: typeof serializeMMRProof;
export type Bytes = Uint8Array;
/**
 * Byte-exact one-leaf MMR leaf used by Minima Address.java path:
 *   sha3( MiniNumber.ZERO || MiniString(script) || MiniNumber.ZERO )
 */
export declare function mmrLeafExact(script: string): Bytes;
/** In a single-leaf MMR the root equals the leaf commitment. */
export declare function mmrRootFromSingleLeaf(script: string): Bytes;
/**
 * MMRData structure matching Minima's MMRData.java
 * Contains hash and value (for sum tree functionality)
 */
export interface MMRData {
    data: Bytes;
    value: bigint;
}
/**
 * MMREntry structure matching Minima's MMREntry.java
 * Represents a node in the MMR at a specific row and position
 */
export interface MMREntry {
    row: number;
    entryNumber: bigint;
    mmrData: MMRData;
}
/**
 * MMRProofChunk - one step in the proof path
 * Matches Minima's MMRProof structure
 */
export interface MMRProofChunk {
    isLeft: boolean;
    mmrData: MMRData;
}
/**
 * MMRProof structure matching Minima's MMRProof.java
 * Contains proof chunks to verify leaf membership in the tree
 */
export interface MMRProof {
    chunks: MMRProofChunk[];
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
export declare function createMMRDataLeafNode(pubkey: Bytes, sumValue?: bigint): MMRData;
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
export declare function createMMRDataParentNode(left: MMRData, right: MMRData): MMRData;
/**
 * Simple MMR Tree for TreeKeyNode
 * Builds a perfect binary tree from N entries (N must be power of 2 for simplicity)
 *
 * This matches TreeKeyNode.java which always uses 64 leaves (2^6)
 */
export declare class MMRTree {
    private entries;
    private leafCount;
    private maxRow;
    private getKey;
    private setEntry;
    private getEntry;
    /**
     * Add a leaf entry to the MMR
     * Matches MMR.java addEntry() but simplified for power-of-2 trees
     */
    addLeaf(data: MMRData): MMREntry;
    /**
     * Build tree from array of Winternitz public keys
     * Used by TreeKeyNode to compute wallet public key
     */
    static fromPublicKeys(pubkeys: Bytes[]): MMRTree;
    /**
     * Get the root of the tree
     * For a perfect binary tree with N leaves, root is at row log2(N), entry 0
     */
    getRoot(): MMRData | null;
    /**
     * Get proof for a leaf at given index
     * Matches MMR.java getProofToPeak()
     */
    getProof(leafIndex: number): MMRProof;
    /**
     * Get the leaf MMRData at a specific index
     */
    getLeaf(index: number): MMRData | null;
}
/**
 * Calculate root from leaf data and proof
 * Matches SignatureProof.getRootPublicKey() in Java
 *
 * From SignatureProof.java:
 *   MMRData pubentry = MMRData.CreateMMRDataLeafNode(mPublicKey, MiniNumber.ZERO);
 *   return mProof.calculateProof(pubentry).getData();
 */
export declare function calculateProofRoot(leafData: MMRData, proof: MMRProof): Bytes;
/**
 * Verify a proof: check that leaf + proof computes to expected root
 */
export declare function verifyMMRProof(leafPubkey: Bytes, proof: MMRProof, expectedRoot: Bytes): boolean;
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
export declare function parseMMRProofFromHex(data: Bytes): {
    proof: MMRProof;
    blockTime: bigint;
    bytesRead: number;
};
/** @deprecated Use parseMMRProofFromHex */
export declare const deserializeMMRProof: typeof parseMMRProofFromHex;
