/**
 * TreeKey/TreeKeyNode Implementation matching Minima's TreeKey.java and TreeKeyNode.java
 *
 * This implements the hierarchical key tree structure where:
 * - Each TreeKeyNode contains 64 Winternitz keys
 * - The node's PUBLIC KEY = MMR root of all 64 Winternitz public keys
 * - Signatures include the Winternitz leaf pubkey + signature + MMR proof
 *
 * Default structure: 3 levels x 64 keys = 64^3 = 262,144 one-time signatures
 */
import { MMRProof, Bytes } from './mmr';
import type { LoggerAdapter } from './adapters';
/**
 * Enable TreeKey debug logging with a custom logger
 * Use this for parity testing to capture wallet init intermediate values
 *
 * WARNING: Debug logging outputs sensitive cryptographic material including
 * seeds and private key derivation. NEVER enable in production builds.
 * This is intended for development/testing parity verification only.
 */
export declare function setTreeKeyLogger(logger: LoggerAdapter): void;
/**
 * Disable TreeKey debug logging
 */
export declare function disableTreeKeyLogger(): void;
/**
 * Check if TreeKey debug logging is enabled
 */
export declare function isTreeKeyDebugEnabled(): boolean;
export declare const DEFAULT_KEYS_PER_LEVEL = 64;
export declare const DEFAULT_LEVELS = 3;
/**
 * Progress callback for key generation
 */
export interface KeyGenProgress {
    phase: 'wots_keys' | 'mmr_build' | 'address_derive' | 'complete';
    current: number;
    total: number;
    message: string;
}
export type ProgressCallback = (progress: KeyGenProgress) => void;
/**
 * SignatureProof structure matching Minima's SignatureProof.java
 *
 * Contains:
 * - leafPubkey: The 32-byte WOTS public key DIGEST (SHA3-256 of full L×32 key)
 * - signature: The 1088-byte Winternitz signature (L×32 bytes)
 * - mmrProof: Proof linking the leaf pubkey to the tree node's root
 *
 * CRITICAL FIX (January 2026): Java's Winternitz.getPublicKey() returns a 32-byte digest!
 *
 * From BouncyCastle WinternitzOTSignature.getPublicKey() (lines 103-121):
 *   byte[] buf = new byte[keysize * mdsize];  // Full 1088 bytes (34×32)
 *   // ... hash each chain 255 times into buf ...
 *   messDigestOTS.update(buf, 0, buf.length);  // Hash the full key
 *   byte[] tmp = new byte[mdsize];             // 32 bytes
 *   messDigestOTS.doFinal(tmp, 0);             // SHA3-256
 *   return tmp;                                 // Returns 32-byte DIGEST!
 *
 * Similarly, WinternitzOTSVerify.Verify() recovers the full key then hashes to 32 bytes.
 * Winternitz.verify() then compares the 32-byte recovered digest to mPublicKey (32 bytes).
 *
 * Previous bug: We stored 1088-byte full keys, Java expected 32-byte digests → always failed.
 */
export interface SignatureProof {
    leafPubkey: Bytes;
    signature: Bytes;
    mmrProof: MMRProof;
}
/**
 * Full Signature structure matching Minima's Signature.java
 *
 * For a 3-level tree, contains 3 SignatureProofs:
 * - Level 0: Signs level 1's root public key
 * - Level 1: Signs level 2's root public key
 * - Level 2: Signs the actual data
 */
export interface TreeSignature {
    proofs: SignatureProof[];
}
/**
 * Compute root public key from a Winternitz signature proof
 * Matches SignatureProof.getRootPublicKey() in Java
 */
export declare function getRootPublicKey(proof: SignatureProof): Bytes;
/**
 * TreeKeyNode - One node in the key tree containing 64 Winternitz keys
 *
 * Matches TreeKeyNode.java (see attached_assets/TreeKeyNode_1767574401422.java):
 *
 * Key generation (lines 44-62):
 * - Creates 64 Winternitz keys from a deterministic seed
 * - For each key: MiniData pubkey = wots.getPublicKey() returns 32-byte DIGEST
 * - Adds to MMR: MMRData.CreateMMRDataLeafNode(pubkey, MiniNumber.ZERO)
 * - Public key = MMR root (mPublicKey = mTree.getRoot().getData())
 *
 * MMR leaf construction (see MMRData.java lines 30-36):
 *   MMRData.CreateMMRDataLeafNode(pubkeyDigest, MiniNumber.ZERO)
 *   → hash = Crypto.hashAllObjects(MiniNumber.ZERO, zData, zSumValue)
 *   → Serialization: [0x00,0x01,0x00] + [4-byte-len + pubkey] + [0x00,0x01,0x00]
 *
 * MMR parent construction (see MMRData.java lines 38-50):
 *   MMRData.CreateMMRDataParentNode(left, right)
 *   → hash = Crypto.hashAllObjects(MiniNumber.ONE, left.data, right.data, sumValue)
 *
 * IMPORTANT: Minima NEVER stores the 1088-byte full WOTS public key.
 * Only the 32-byte digest is stored and used for MMR construction.
 */
export declare class TreeKeyNode {
    private seed;
    private childSeed;
    private keysPerLevel;
    private publicKeyDigests;
    private mmrTree;
    private rootPubkey;
    private childCache;
    constructor(privateSeed: Bytes, keysPerLevel?: number);
    /**
     * Async factory method for TreeKeyNode with progress reporting
     * Yields to event loop every few keys to keep UI responsive
     */
    static createWithProgress(privateSeed: Bytes, keysPerLevel?: number, onProgress?: ProgressCallback): Promise<TreeKeyNode>;
    /**
     * Get the public key for this tree node (MMR root of all 64 Winternitz keys)
     */
    getPublicKey(): Bytes;
    /**
     * Get the full Winternitz public key at a specific index (0-63)
     * Returns the full L×32 byte public key (1088 bytes), derived on-demand
     *
     * NOTE: This is only used for local signature verification in tests.
     * Java's Winternitz.getPublicKey() returns a 32-byte digest, not this.
     * For production code, use getWOTSPublicKeyDigest() instead.
     *
     * @deprecated Use getWOTSPublicKeyDigest() for Minima compatibility
     */
    getWOTSPublicKey(index: number): Bytes;
    /**
     * Get the Winternitz public key digest at a specific index (0-63)
     * Returns the 32-byte SHA3 hash of the full public key
     */
    getWOTSPublicKeyDigest(index: number): Bytes;
    /**
     * Get the MMR proof for a specific key index
     */
    getProof(keyIndex: number): MMRProof;
    /**
     * Sign data with a specific key from this node
     * Returns a SignatureProof containing the 32-byte leaf pubkey DIGEST, signature, and MMR proof
     *
     * CRITICAL: Java's WinternitzOTSignature.getSignature() ALWAYS hashes the message first,
     * regardless of input length. From BouncyCastle WinternitzOTSignature.java lines 137-138:
     *   messDigestOTS.update(message, 0, message.length);
     *   messDigestOTS.doFinal(hash, 0);
     *
     * We MUST always hash to match Java verification, which also always hashes.
     *
     * CRITICAL FIX (January 2026): leafPubkey is the 32-byte WOTS public key DIGEST.
     * Java's Winternitz.getPublicKey() returns SHA3-256(full_key) = 32 bytes!
     * Previous bug: We stored 1088-byte full keys, Java expected 32-byte digests → verification failed.
     */
    sign(keyIndex: number, data: Bytes): SignatureProof;
    /**
     * Create a child TreeKeyNode at the specified index
     * Matches TreeKeyNode.java getChild()
     *
     * PERFORMANCE FIX: Child nodes are now cached to avoid regenerating
     * 64 WOTS keys on every getChild() call. This is critical for address
     * derivation performance where getChild() is called 64 times.
     */
    getChild(childIndex: number): TreeKeyNode;
}
/**
 * TreeKey - Full hierarchical key tree with multiple levels
 *
 * Matches TreeKey.java:
 * - Default: 3 levels x 64 keys = 262,144 one-time signatures
 * - Tracks usage count to determine which key to use
 * - Produces multi-level signatures
 */
export declare class TreeKey {
    private privateSeed;
    private levels;
    private keysPerLevel;
    private root;
    private publicKey;
    private uses;
    /**
     * Parent-child signature cache for efficiency
     * Key format: "l1" for root->level1, "l1,l2" for level1->level2
     * Value: SignatureProof for parent signing child's pubkey
     */
    private parentChildSigCache;
    constructor(privateSeed: Bytes, keysPerLevel?: number, levels?: number);
    /**
     * Async factory method for TreeKey with progress reporting
     * Reports progress as the root TreeKeyNode generates its 64 signing keys
     */
    static createWithProgress(privateSeed: Bytes, keysPerLevel?: number, levels?: number, onProgress?: ProgressCallback): Promise<TreeKey>;
    /**
     * Get the root TreeKeyNode (for internal use)
     */
    getRootNode(): TreeKeyNode;
    /**
     * Get the root public key (for watermark tracking)
     */
    getRootPublicKey(): Bytes;
    /**
     * Get the wallet's public key (root of the key tree)
     */
    getPublicKey(): Bytes;
    /**
     * Get the maximum number of signatures this tree can produce
     */
    getMaxUses(): number;
    /**
     * Get current usage count
     */
    getUses(): number;
    /**
     * Set the usage counter (for resuming from a known state)
     */
    setUses(uses: number): void;
    /**
     * Generate cache key for parent-child signature
     * @param path - Array of indices leading to the child (e.g., [l1] or [l1, l2])
     */
    private getCacheKey;
    /**
     * Check if a parent-child signature is cached
     * @param path - Array of indices (e.g., [l1] for root->level1)
     */
    hasParentChildSig(path: number[]): boolean;
    /**
     * Get a cached parent-child signature
     * @param path - Array of indices (e.g., [l1] for root->level1)
     */
    getParentChildSig(path: number[]): SignatureProof | undefined;
    /**
     * Cache a parent-child signature for reuse
     * This allows the same signature to be reused across multiple signing operations
     *
     * @param path - Array of indices leading to the child (e.g., [l1] or [l1, l2])
     * @param sig - SignatureProof from parent signing child's public key
     */
    setParentChildSig(path: number[], sig: SignatureProof): void;
    /**
     * Get all cached parent-child signatures (for serialization/persistence)
     */
    getCachedSignatures(): Map<string, SignatureProof>;
    /**
     * Restore cached signatures (for hydrating from persistence)
     */
    restoreCachedSignatures(cache: Map<string, SignatureProof>): void;
    /**
     * Convert a usage number to the path through the tree
     * Matches TreeKey.java baseConversion()
     *
     * For uses=0: [0,0,0]
     * For uses=1: [0,0,1]
     * For uses=64: [0,1,0]
     * etc.
     */
    private baseConversion;
    /**
     * Sign data with the current key and increment usage
     *
     * Matches TreeKey.java sign():
     * - Determines path through tree based on usage count
     * - Each level's key signs the next level's root public key
     * - Final level signs the actual data
     *
     * CRITICAL FIX (January 2026): Build proofs bottom-up to sign child's getRootPublicKey()
     *
     * Java's TreeKey.verify() verifies non-leaf signatures against childsig.getRootPublicKey(),
     * which is the 32-byte MMR root computed from the NEXT proof's leafPubkey + MMRproof.
     *
     * Uses parent-child signature caching for efficiency:
     * - Parent-child signatures are cached and reused
     * - Only the final data signature is computed fresh each time
     */
    sign(data: Bytes): TreeSignature;
    /**
     * Get the public key for a level-1 address (single index)
     * This is the MMR root of the level-1 TreeKeyNode's 64 Winternitz keys.
     *
     * Use this for wallet addresses where each address = one level-1 node.
     *
     * @param l1 - Level 1 index (0-63, corresponds to wallet address index)
     * @returns 32-byte MMR root public key for SIGNEDBY scripts
     */
    getAddressPublicKey(l1: number): Bytes;
    /**
     * Get the public key for a specific signing key at tree index (l1, l2)
     * This navigates to the level-2 node for signing operations.
     *
     * @param l1 - Level 1 index (address)
     * @param l2 - Level 2 index (signing key within address)
     * @returns 32-byte MMR root public key of level-2 node
     */
    getSigningNodePublicKey(l1: number, l2: number): Bytes;
}
/**
 * Verify a tree signature against expected public key and data
 *
 * Matches TreeKey.java verify():
 * - First proof's computed root must match expected public key
 * - Each intermediate proof must sign the next level's root
 * - Final proof must verify against the actual data
 */
export declare function verifyTreeSignature(expectedPubkey: Bytes, data: Bytes, signature: TreeSignature): boolean;
/**
 * Serialize a TreeSignature to bytes
 *
 * Uses Streamable.writeSignature() for byte-exact compatibility
 * with Java's Signature.writeDataStream().
 */
export declare function serializeTreeSignature(sig: TreeSignature): Bytes;
/**
 * Deserialize a TreeSignature from bytes
 *
 * Matches Java's Signature.readDataStream():
 * - Number of proofs: MiniNumber format
 * - Each SignatureProof: MiniData(pubkey) + MiniData(signature) + MMRProof
 */
export declare function deserializeTreeSignature(data: Bytes): TreeSignature;
/**
 * ============================================================================
 * PER-ADDRESS TREEKEY FACTORY
 * ============================================================================
 *
 * Minima Wallet.createNewKey() creates independent TreeKeys per address:
 *   MiniData modifier = new MiniData(new BigInteger(Integer.toString(numkeys)));
 *   MiniData privseed = Crypto.getInstance().hashObjects(baseSeed, modifier);
 *   TreeKey treekey = TreeKey.createDefault(privseed);
 *
 * Each address gets its own TreeKey with:
 * - Unique seed derived from baseSeed + addressIndex
 * - Size=64, depth=3 (matching TreeKey.createDefault)
 * - 4096 one-time signatures per address (64×64)
 *
 * Total wallet capacity: 64 addresses × 4096 signatures = 262,144 signatures
 * ============================================================================
 */
/**
 * Create a per-address TreeKey matching Minima Wallet.createNewKey()
 *
 * @param baseSeed - 32-byte wallet base seed (from mnemonic)
 * @param addressIndex - Address index (0-63)
 * @returns TreeKey for this address with size=64, depth=3
 */
export declare function createPerAddressTreeKey(baseSeed: Bytes, addressIndex: number): TreeKey;
/**
 * Async version with progress reporting for UI
 *
 * @param baseSeed - 32-byte wallet base seed
 * @param addressIndex - Address index (0-63)
 * @param onProgress - Optional progress callback
 * @returns Promise resolving to TreeKey for this address
 */
export declare function createPerAddressTreeKeyAsync(baseSeed: Bytes, addressIndex: number, onProgress?: ProgressCallback): Promise<TreeKey>;
/**
 * Derive address public key from base seed and address index
 *
 * This is the fast path for getting an address public key without
 * needing to construct the full TreeKey. Useful for address derivation
 * during wallet initialization.
 *
 * @param baseSeed - 32-byte wallet base seed
 * @param addressIndex - Address index (0-63)
 * @returns 32-byte address public key (MMR root of per-address TreeKey)
 */
export declare function deriveAddressPublicKey(baseSeed: Bytes, addressIndex: number): Bytes;
/**
 * Get the address public key from a per-address TreeKey
 *
 * In the per-address architecture, each address has its own TreeKey,
 * and the address public key is simply the TreeKey's root public key.
 *
 * @param treeKey - Per-address TreeKey
 * @returns 32-byte address public key (TreeKey root)
 */
export declare function getPerAddressPublicKey(treeKey: TreeKey): Bytes;
