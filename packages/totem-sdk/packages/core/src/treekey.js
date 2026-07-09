"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreeKey = exports.TreeKeyNode = exports.DEFAULT_LEVELS = exports.DEFAULT_KEYS_PER_LEVEL = void 0;
exports.setTreeKeyLogger = setTreeKeyLogger;
exports.disableTreeKeyLogger = disableTreeKeyLogger;
exports.isTreeKeyDebugEnabled = isTreeKeyDebugEnabled;
exports.getRootPublicKey = getRootPublicKey;
exports.verifyTreeSignature = verifyTreeSignature;
exports.serializeTreeSignature = serializeTreeSignature;
exports.deserializeTreeSignature = deserializeTreeSignature;
exports.createPerAddressTreeKey = createPerAddressTreeKey;
exports.createPerAddressTreeKeyAsync = createPerAddressTreeKeyAsync;
exports.deriveAddressPublicKey = deriveAddressPublicKey;
exports.getPerAddressPublicKey = getPerAddressPublicKey;
const javaStreamables_1 = require("./javaStreamables");
const wots_1 = require("./wots");
const params_1 = require("./params");
const mmr_1 = require("./mmr");
const Streamable_1 = require("./Streamable");
const adapters_1 = require("./adapters");
// Module-level debug logger - can be set externally for parity testing
let treeKeyLogger = new adapters_1.NoopLogger();
let treeKeyDebugEnabled = false;
/**
 * Enable TreeKey debug logging with a custom logger
 * Use this for parity testing to capture wallet init intermediate values
 *
 * WARNING: Debug logging outputs sensitive cryptographic material including
 * seeds and private key derivation. NEVER enable in production builds.
 * This is intended for development/testing parity verification only.
 */
function setTreeKeyLogger(logger) {
    treeKeyLogger = logger;
    treeKeyDebugEnabled = true;
}
/**
 * Disable TreeKey debug logging
 */
function disableTreeKeyLogger() {
    treeKeyLogger = new adapters_1.NoopLogger();
    treeKeyDebugEnabled = false;
}
/**
 * Check if TreeKey debug logging is enabled
 */
function isTreeKeyDebugEnabled() {
    return treeKeyDebugEnabled;
}
exports.DEFAULT_KEYS_PER_LEVEL = 64;
exports.DEFAULT_LEVELS = 3;
/**
 * Compute root public key from a Winternitz signature proof
 * Matches SignatureProof.getRootPublicKey() in Java
 */
function getRootPublicKey(proof) {
    const leafData = (0, mmr_1.createMMRDataLeafNode)(proof.leafPubkey, 0n);
    return (0, mmr_1.calculateProofRoot)(leafData, proof.mmrProof);
}
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
class TreeKeyNode {
    constructor(privateSeed, keysPerLevel = exports.DEFAULT_KEYS_PER_LEVEL) {
        this.childCache = new Map();
        if (privateSeed.length !== 32) {
            throw new Error('Private seed must be 32 bytes');
        }
        if (treeKeyDebugEnabled) {
            treeKeyLogger.debug(`[TreeKeyNode] ========== INIT START ==========`);
            treeKeyLogger.debug(`[TreeKeyNode] Private seed: ${(0, wots_1.hex)(privateSeed)}`);
            treeKeyLogger.debug(`[TreeKeyNode] Keys per level: ${keysPerLevel}`);
        }
        this.seed = privateSeed;
        this.keysPerLevel = keysPerLevel;
        // Hash the seed to create child seed (for deriving child nodes)
        // From TreeKeyNode.java: mChildSeed = Crypto.getInstance().hashObject(zPrivateSeed);
        // hashObject serializes as MiniData (length-prefixed) then hashes
        this.childSeed = (0, javaStreamables_1.hashObject)(privateSeed);
        if (treeKeyDebugEnabled) {
            treeKeyLogger.debug(`[TreeKeyNode] Child seed (hashObject): ${(0, wots_1.hex)(this.childSeed)}`);
        }
        // Generate all Winternitz public key DIGESTS (32 bytes each)
        // Java's Winternitz.getPublicKey() returns SHA3-256(full_key) = 32 bytes
        // See WinternitzOTSignature.getPublicKey() lines 103-121: hashes full 1088B key, returns 32B digest
        // TreeKeyNode.java line 53: MiniData pubkey = wots.getPublicKey() - stores the 32B digest
        // MMRData.CreateMMRDataLeafNode(pubkey, MiniNumber.ZERO) - builds leaves from digests
        this.publicKeyDigests = [];
        for (let i = 0; i < keysPerLevel; i++) {
            // Digest (32 bytes) - used for MMR tree, SignatureProof.leafPubkey, and address derivation
            const pkDigest = (0, wots_1.derivePKdigest)(privateSeed, i, (0, params_1.getParamSet)());
            this.publicKeyDigests.push(pkDigest);
            // Log first few keys for debugging
            if (treeKeyDebugEnabled && i < 3) {
                treeKeyLogger.debug(`[TreeKeyNode] WOTS key[${i}] digest (32B): ${(0, wots_1.hex)(pkDigest)}`);
            }
        }
        if (treeKeyDebugEnabled) {
            treeKeyLogger.debug(`[TreeKeyNode] Generated ${this.publicKeyDigests.length} WOTS key digests`);
            const lastIdx = this.publicKeyDigests.length - 1;
            treeKeyLogger.debug(`[TreeKeyNode] WOTS key[${lastIdx}] digest: ${(0, wots_1.hex)(this.publicKeyDigests[lastIdx])}`);
        }
        // Build MMR tree from 32-byte PUBLIC KEY DIGESTS (Java-compatible)
        // Java's TreeKeyNode: MMRData.CreateMMRDataLeafNode(wots.getPublicKey(), ZERO)
        // where getPublicKey() returns SHA3-256(full_key) = 32-byte DIGEST
        this.mmrTree = mmr_1.MMRTree.fromPublicKeys(this.publicKeyDigests);
        // Root public key = MMR root
        const root = this.mmrTree.getRoot();
        if (!root) {
            throw new Error('Failed to compute MMR root');
        }
        this.rootPubkey = root.data;
        if (treeKeyDebugEnabled) {
            treeKeyLogger.debug(`[TreeKeyNode] MMR root (node public key): ${(0, wots_1.hex)(this.rootPubkey)}`);
            treeKeyLogger.debug(`[TreeKeyNode] ========== INIT END ==========`);
        }
    }
    /**
     * Async factory method for TreeKeyNode with progress reporting
     * Yields to event loop every few keys to keep UI responsive
     */
    static async createWithProgress(privateSeed, keysPerLevel = exports.DEFAULT_KEYS_PER_LEVEL, onProgress) {
        if (privateSeed.length !== 32) {
            throw new Error('Private seed must be 32 bytes');
        }
        const node = Object.create(TreeKeyNode.prototype);
        node.seed = privateSeed;
        node.keysPerLevel = keysPerLevel;
        node.childSeed = (0, javaStreamables_1.hashObject)(privateSeed);
        node.publicKeyDigests = [];
        node.childCache = new Map();
        // Generate Winternitz public key DIGESTS with progress (32 bytes each)
        // Java's Winternitz.getPublicKey() returns SHA3-256(full_key) = 32 bytes
        // See WinternitzOTSignature.getPublicKey() lines 103-121: hashes full 1088B key, returns 32B digest
        for (let i = 0; i < keysPerLevel; i++) {
            // Digest (32 bytes) - used for MMR tree, SignatureProof.leafPubkey, and address derivation
            const pkDigest = (0, wots_1.derivePKdigest)(privateSeed, i, (0, params_1.getParamSet)());
            node.publicKeyDigests.push(pkDigest);
            // Report progress every 4 keys and yield to event loop
            if (onProgress && (i + 1) % 4 === 0) {
                onProgress({
                    phase: 'wots_keys',
                    current: i + 1,
                    total: keysPerLevel,
                    message: `Generating signing key ${i + 1}/${keysPerLevel}`
                });
                // Yield to event loop to keep UI responsive
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        // Report MMR build phase
        if (onProgress) {
            onProgress({
                phase: 'mmr_build',
                current: 0,
                total: 1,
                message: 'Building secure Merkle tree...'
            });
        }
        // Build MMR tree from 32-byte PUBLIC KEY DIGESTS (Java-compatible)
        // Java's TreeKeyNode: MMRData.CreateMMRDataLeafNode(wots.getPublicKey(), ZERO)
        // where getPublicKey() returns SHA3-256(full_key) = 32-byte DIGEST
        node.mmrTree = mmr_1.MMRTree.fromPublicKeys(node.publicKeyDigests);
        const root = node.mmrTree.getRoot();
        if (!root) {
            throw new Error('Failed to compute MMR root');
        }
        node.rootPubkey = root.data;
        if (onProgress) {
            onProgress({
                phase: 'mmr_build',
                current: 1,
                total: 1,
                message: 'Merkle tree complete'
            });
        }
        return node;
    }
    /**
     * Get the public key for this tree node (MMR root of all 64 Winternitz keys)
     */
    getPublicKey() {
        return this.rootPubkey;
    }
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
    getWOTSPublicKey(index) {
        if (index < 0 || index >= this.keysPerLevel) {
            throw new Error(`Key index ${index} out of range [0, ${this.keysPerLevel})`);
        }
        // Derive on-demand - expensive but only used for tests
        return (0, wots_1.deriveFullPublicKey)(this.seed, index, (0, params_1.getParamSet)());
    }
    /**
     * Get the Winternitz public key digest at a specific index (0-63)
     * Returns the 32-byte SHA3 hash of the full public key
     */
    getWOTSPublicKeyDigest(index) {
        if (index < 0 || index >= this.keysPerLevel) {
            throw new Error(`Key index ${index} out of range [0, ${this.keysPerLevel})`);
        }
        return this.publicKeyDigests[index];
    }
    /**
     * Get the MMR proof for a specific key index
     */
    getProof(keyIndex) {
        return this.mmrTree.getProof(keyIndex);
    }
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
    sign(keyIndex, data) {
        if (keyIndex < 0 || keyIndex >= this.keysPerLevel) {
            throw new Error(`Key index ${keyIndex} out of range [0, ${this.keysPerLevel})`);
        }
        if (treeKeyDebugEnabled) {
            treeKeyLogger.debug(`[TreeKeyNode.sign] ========== SIGN START ==========`);
            treeKeyLogger.debug(`[TreeKeyNode.sign] keyIndex: ${keyIndex}`);
            treeKeyLogger.debug(`[TreeKeyNode.sign] input data (${data.length}B): ${(0, wots_1.hex)(data).substring(0, 64)}${data.length > 32 ? '...' : ''}`);
        }
        // Get the 32-byte Winternitz public key DIGEST for SignatureProof
        // CRITICAL FIX: Java's Winternitz.getPublicKey() returns SHA3-256(full_key) = 32 bytes!
        // NOT the 1088-byte full key! This was the bug causing "allsignaturesvalid":false errors.
        const leafPubkey = this.publicKeyDigests[keyIndex];
        if (treeKeyDebugEnabled) {
            treeKeyLogger.debug(`[TreeKeyNode.sign] leafPubkey (${leafPubkey.length}B DIGEST): ${(0, wots_1.hex)(leafPubkey)}`);
        }
        // CRITICAL: Do NOT pre-hash here! wotsSign() now handles internal hashing (matching Java/BouncyCastle).
        // Java's WinternitzOTSignature.getSignature() hashes internally, so wotsSign() does too.
        // Call sites pass the same 32-byte values Java passes:
        //   - For TX signing: the 32-byte transaction digest
        //   - For parent→child: the 32-byte childRoot (MMR root of child proof)
        // WOTS hashes once internally - this is by design for Minima compatibility.
        if (treeKeyDebugEnabled) {
            treeKeyLogger.debug(`[TreeKeyNode.sign] dataToSign (raw input, WOTS hashes internally): ${(0, wots_1.hex)(data)}`);
        }
        // Sign data directly - wotsSign() handles internal hashing
        const signature = (0, wots_1.wotsSign)(this.seed, keyIndex, data, (0, params_1.getParamSet)());
        if (treeKeyDebugEnabled) {
            treeKeyLogger.debug(`[TreeKeyNode.sign] signature (${signature.length}B): ${(0, wots_1.hex)(signature).substring(0, 64)}...${(0, wots_1.hex)(signature).substring((0, wots_1.hex)(signature).length - 32)}`);
        }
        // Get the MMR proof for this key
        const mmrProof = this.getProof(keyIndex);
        if (treeKeyDebugEnabled) {
            treeKeyLogger.debug(`[TreeKeyNode.sign] MMR proof chunks: ${mmrProof.chunks.length}`);
            treeKeyLogger.debug(`[TreeKeyNode.sign] ========== SIGN END ==========`);
        }
        return { leafPubkey, signature, mmrProof };
    }
    /**
     * Create a child TreeKeyNode at the specified index
     * Matches TreeKeyNode.java getChild()
     *
     * PERFORMANCE FIX: Child nodes are now cached to avoid regenerating
     * 64 WOTS keys on every getChild() call. This is critical for address
     * derivation performance where getChild() is called 64 times.
     */
    getChild(childIndex) {
        if (childIndex < 0 || childIndex >= this.keysPerLevel) {
            throw new Error(`Child index ${childIndex} out of range [0, ${this.keysPerLevel})`);
        }
        // Check cache first
        const cached = this.childCache.get(childIndex);
        if (cached) {
            if (treeKeyDebugEnabled) {
                treeKeyLogger.debug(`[TreeKeyNode.getChild] Using cached child at index ${childIndex}`);
            }
            return cached;
        }
        if (treeKeyDebugEnabled) {
            treeKeyLogger.debug(`[TreeKeyNode.getChild] Creating child at index ${childIndex}`);
            treeKeyLogger.debug(`[TreeKeyNode.getChild] Parent childSeed: ${(0, wots_1.hex)(this.childSeed)}`);
        }
        // From TreeKeyNode.java:
        // MiniData seed = Crypto.getInstance().hashAllObjects(new MiniNumber(zChild), mChildSeed);
        const childSeed = (0, javaStreamables_1.deriveChainSeedJava)(this.childSeed, childIndex);
        if (treeKeyDebugEnabled) {
            treeKeyLogger.debug(`[TreeKeyNode.getChild] Derived childSeed: ${(0, wots_1.hex)(childSeed)}`);
        }
        const child = new TreeKeyNode(childSeed, this.keysPerLevel);
        if (treeKeyDebugEnabled) {
            treeKeyLogger.debug(`[TreeKeyNode.getChild] Child public key: ${(0, wots_1.hex)(child.getPublicKey())}`);
        }
        // Cache for future use
        this.childCache.set(childIndex, child);
        return child;
    }
}
exports.TreeKeyNode = TreeKeyNode;
/**
 * TreeKey - Full hierarchical key tree with multiple levels
 *
 * Matches TreeKey.java:
 * - Default: 3 levels x 64 keys = 262,144 one-time signatures
 * - Tracks usage count to determine which key to use
 * - Produces multi-level signatures
 */
class TreeKey {
    constructor(privateSeed, keysPerLevel = exports.DEFAULT_KEYS_PER_LEVEL, levels = exports.DEFAULT_LEVELS) {
        this.uses = 0;
        /**
         * Parent-child signature cache for efficiency
         * Key format: "l1" for root->level1, "l1,l2" for level1->level2
         * Value: SignatureProof for parent signing child's pubkey
         */
        this.parentChildSigCache = new Map();
        if (privateSeed.length !== 32) {
            throw new Error('Private seed must be 32 bytes');
        }
        if (treeKeyDebugEnabled) {
            treeKeyLogger.debug(`[TreeKey] ========== WALLET INIT START ==========`);
            treeKeyLogger.debug(`[TreeKey] Private seed: ${(0, wots_1.hex)(privateSeed)}`);
            treeKeyLogger.debug(`[TreeKey] Levels: ${levels}, Keys per level: ${keysPerLevel}`);
            treeKeyLogger.debug(`[TreeKey] Total capacity: ${Math.pow(keysPerLevel, levels)} signatures`);
        }
        this.privateSeed = privateSeed;
        this.levels = levels;
        this.keysPerLevel = keysPerLevel;
        // Initialize root node
        this.root = new TreeKeyNode(privateSeed, keysPerLevel);
        this.publicKey = this.root.getPublicKey();
        if (treeKeyDebugEnabled) {
            treeKeyLogger.debug(`[TreeKey] Root public key: ${(0, wots_1.hex)(this.publicKey)}`);
            treeKeyLogger.debug(`[TreeKey] ========== WALLET INIT END ==========`);
        }
    }
    /**
     * Async factory method for TreeKey with progress reporting
     * Reports progress as the root TreeKeyNode generates its 64 signing keys
     */
    static async createWithProgress(privateSeed, keysPerLevel = exports.DEFAULT_KEYS_PER_LEVEL, levels = exports.DEFAULT_LEVELS, onProgress) {
        if (privateSeed.length !== 32) {
            throw new Error('Private seed must be 32 bytes');
        }
        const treeKey = Object.create(TreeKey.prototype);
        treeKey.privateSeed = privateSeed;
        treeKey.levels = levels;
        treeKey.keysPerLevel = keysPerLevel;
        treeKey.uses = 0;
        treeKey.parentChildSigCache = new Map();
        // Create root node with progress reporting
        treeKey.root = await TreeKeyNode.createWithProgress(privateSeed, keysPerLevel, onProgress);
        treeKey.publicKey = treeKey.root.getPublicKey();
        if (onProgress) {
            onProgress({
                phase: 'complete',
                current: keysPerLevel,
                total: keysPerLevel,
                message: 'Key tree ready'
            });
        }
        return treeKey;
    }
    /**
     * Get the root TreeKeyNode (for internal use)
     */
    getRootNode() {
        return this.root;
    }
    /**
     * Get the root public key (for watermark tracking)
     */
    getRootPublicKey() {
        return this.publicKey;
    }
    /**
     * Get the wallet's public key (root of the key tree)
     */
    getPublicKey() {
        return this.publicKey;
    }
    /**
     * Get the maximum number of signatures this tree can produce
     */
    getMaxUses() {
        return Math.pow(this.keysPerLevel, this.levels);
    }
    /**
     * Get current usage count
     */
    getUses() {
        return this.uses;
    }
    /**
     * Set the usage counter (for resuming from a known state)
     */
    setUses(uses) {
        this.uses = uses;
    }
    /**
     * Generate cache key for parent-child signature
     * @param path - Array of indices leading to the child (e.g., [l1] or [l1, l2])
     */
    getCacheKey(path) {
        return path.join(',');
    }
    /**
     * Check if a parent-child signature is cached
     * @param path - Array of indices (e.g., [l1] for root->level1)
     */
    hasParentChildSig(path) {
        return this.parentChildSigCache.has(this.getCacheKey(path));
    }
    /**
     * Get a cached parent-child signature
     * @param path - Array of indices (e.g., [l1] for root->level1)
     */
    getParentChildSig(path) {
        return this.parentChildSigCache.get(this.getCacheKey(path));
    }
    /**
     * Cache a parent-child signature for reuse
     * This allows the same signature to be reused across multiple signing operations
     *
     * @param path - Array of indices leading to the child (e.g., [l1] or [l1, l2])
     * @param sig - SignatureProof from parent signing child's public key
     */
    setParentChildSig(path, sig) {
        this.parentChildSigCache.set(this.getCacheKey(path), sig);
    }
    /**
     * Get all cached parent-child signatures (for serialization/persistence)
     */
    getCachedSignatures() {
        return new Map(this.parentChildSigCache);
    }
    /**
     * Restore cached signatures (for hydrating from persistence)
     */
    restoreCachedSignatures(cache) {
        this.parentChildSigCache = new Map(cache);
    }
    /**
     * Convert a usage number to the path through the tree
     * Matches TreeKey.java baseConversion()
     *
     * For uses=0: [0,0,0]
     * For uses=1: [0,0,1]
     * For uses=64: [0,1,0]
     * etc.
     */
    baseConversion(num) {
        const result = [];
        let counter = num;
        while (counter !== 0) {
            const div = Math.floor(counter / this.keysPerLevel);
            const remain = counter - (div * this.keysPerLevel);
            result.push(remain);
            counter = div;
        }
        // Pad to required levels
        while (result.length < this.levels) {
            result.push(0);
        }
        // Reverse to get [addressIndex, l1, l2] order
        result.reverse();
        return result;
    }
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
    sign(data) {
        if (this.uses >= this.getMaxUses()) {
            throw new Error('No more keys available (tree exhausted)');
        }
        // Get the path through the tree
        const path = this.baseConversion(this.uses);
        // Navigate to all nodes first
        const nodes = [this.root];
        let currentNode = this.root;
        for (let i = 0; i < this.levels - 1; i++) {
            currentNode = currentNode.getChild(path[i]);
            nodes.push(currentNode);
        }
        // nodes = [root, L1, L2] for a 3-level tree
        // ═══════════════════════════════════════════════════════════════════════════
        // BUILD PROOFS BOTTOM-UP: Start from leaf, work up to root
        // This ensures we sign exactly what Java's verification will compute.
        // ═══════════════════════════════════════════════════════════════════════════
        const proofs = new Array(this.levels);
        // STEP 1: Create leaf proof FIRST (signs actual data)
        const leafDepth = this.levels - 1;
        const leafNode = nodes[leafDepth];
        const leafKeyIndex = path[leafDepth];
        const leafProof = leafNode.sign(leafKeyIndex, data);
        proofs[leafDepth] = leafProof;
        // STEP 2: Work backwards, each parent signs childProof.getRootPublicKey()
        for (let depth = this.levels - 2; depth >= 0; depth--) {
            const parentNode = nodes[depth];
            const keyIndex = path[depth];
            const childProof = proofs[depth + 1];
            const childRoot = getRootPublicKey(childProof);
            // Cache key includes full path to ensure uniqueness
            const cachePath = path.slice(0, depth + 2);
            let sigProof = this.getParentChildSig(cachePath);
            if (!sigProof) {
                // Not cached: compute and cache
                sigProof = parentNode.sign(keyIndex, childRoot); // Sign the 32-byte MMR root!
                this.setParentChildSig(cachePath, sigProof);
            }
            proofs[depth] = sigProof;
        }
        // Increment usage counter
        this.uses++;
        return { proofs };
    }
    /**
     * Get the public key for a level-1 address (single index)
     * This is the MMR root of the level-1 TreeKeyNode's 64 Winternitz keys.
     *
     * Use this for wallet addresses where each address = one level-1 node.
     *
     * @param l1 - Level 1 index (0-63, corresponds to wallet address index)
     * @returns 32-byte MMR root public key for SIGNEDBY scripts
     */
    getAddressPublicKey(l1) {
        // Get level-1 child node's public key (MMR root of its 64 WOTS keys)
        const level1Node = this.root.getChild(l1);
        return level1Node.getPublicKey();
    }
    /**
     * Get the public key for a specific signing key at tree index (l1, l2)
     * This navigates to the level-2 node for signing operations.
     *
     * @param l1 - Level 1 index (address)
     * @param l2 - Level 2 index (signing key within address)
     * @returns 32-byte MMR root public key of level-2 node
     */
    getSigningNodePublicKey(l1, l2) {
        // Navigate to level 2 node
        const level1Node = this.root.getChild(l1);
        const level2Node = level1Node.getChild(l2);
        return level2Node.getPublicKey();
    }
}
exports.TreeKey = TreeKey;
/**
 * Verify a tree signature against expected public key and data
 *
 * Matches TreeKey.java verify():
 * - First proof's computed root must match expected public key
 * - Each intermediate proof must sign the next level's root
 * - Final proof must verify against the actual data
 */
function verifyTreeSignature(expectedPubkey, data, signature) {
    const { proofs } = signature;
    if (proofs.length === 0) {
        return false;
    }
    // Import wotsVerify for verification
    const { wotsVerify } = require('./wots');
    const paramSet = (0, params_1.getParamSet)();
    for (let depth = 0; depth < proofs.length; depth++) {
        const proof = proofs[depth];
        // Compute the root public key from this proof
        const rootPubkey = getRootPublicKey(proof);
        // First level: must match expected public key
        if (depth === 0) {
            for (let i = 0; i < expectedPubkey.length; i++) {
                if (rootPubkey[i] !== expectedPubkey[i]) {
                    return false;
                }
            }
        }
        // Determine what was signed
        let signedData;
        if (depth === proofs.length - 1) {
            // Final level: signed the actual data
            signedData = data;
        }
        else {
            // Intermediate level: signed the next level's root public key
            signedData = getRootPublicKey(proofs[depth + 1]);
        }
        // Verify the Winternitz signature
        // Use wotsVerifyDigest since leafPubkey is now a 32-byte digest (not 1088-byte full key)
        if (!(0, wots_1.wotsVerifyDigest)(proof.signature, signedData, proof.leafPubkey, paramSet)) {
            return false;
        }
    }
    return true;
}
/**
 * Serialize a TreeSignature to bytes
 *
 * Uses Streamable.writeSignature() for byte-exact compatibility
 * with Java's Signature.writeDataStream().
 */
function serializeTreeSignature(sig) {
    // Convert to Streamable format (adds blockTime to MMRProof)
    const streamableSig = {
        proofs: sig.proofs.map(proof => ({
            leafPubkey: proof.leafPubkey,
            signature: proof.signature,
            mmrProof: {
                blockTime: 0n, // Default for compatibility
                chunks: proof.mmrProof.chunks
            }
        }))
    };
    // Use canonical serializer for byte-exact Java compatibility
    return (0, Streamable_1.writeSignature)(streamableSig);
}
/**
 * Deserialize a TreeSignature from bytes
 *
 * Matches Java's Signature.readDataStream():
 * - Number of proofs: MiniNumber format
 * - Each SignatureProof: MiniData(pubkey) + MiniData(signature) + MMRProof
 */
function deserializeTreeSignature(data) {
    let offset = 0;
    // Read MiniNumber for proof count
    // Format: [scale: 1 byte] [length: 1 byte] [data: N bytes]
    const scale = data[offset];
    const numBytesLen = data[offset + 1];
    offset += 2;
    // Read the number bytes (big-endian)
    let numProofs = 0;
    for (let i = 0; i < numBytesLen; i++) {
        numProofs = (numProofs << 8) | data[offset + i];
    }
    offset += numBytesLen;
    const proofs = [];
    for (let i = 0; i < numProofs; i++) {
        // Leaf pubkey - MiniData format (4-byte length prefix + data)
        const pubkeyLen = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
        offset += 4;
        const leafPubkey = data.slice(offset, offset + pubkeyLen);
        offset += pubkeyLen;
        // Signature - MiniData format (4-byte length prefix + data)
        const sigLen = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
        offset += 4;
        const signature = data.slice(offset, offset + sigLen);
        offset += sigLen;
        // MMR proof - returns { proof, blockTime, bytesRead }
        const { proof: mmrProof, bytesRead: mmrProofLen } = (0, mmr_1.deserializeMMRProof)(data.slice(offset));
        offset += mmrProofLen;
        proofs.push({ leafPubkey, signature, mmrProof });
    }
    return { proofs };
}
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
function createPerAddressTreeKey(baseSeed, addressIndex) {
    const addressSeed = (0, javaStreamables_1.derivePerAddressSeed)(baseSeed, addressIndex);
    return new TreeKey(addressSeed, 64, 3);
}
/**
 * Async version with progress reporting for UI
 *
 * @param baseSeed - 32-byte wallet base seed
 * @param addressIndex - Address index (0-63)
 * @param onProgress - Optional progress callback
 * @returns Promise resolving to TreeKey for this address
 */
async function createPerAddressTreeKeyAsync(baseSeed, addressIndex, onProgress) {
    const addressSeed = (0, javaStreamables_1.derivePerAddressSeed)(baseSeed, addressIndex);
    return TreeKey.createWithProgress(addressSeed, 64, 3, onProgress);
}
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
function deriveAddressPublicKey(baseSeed, addressIndex) {
    const treeKey = createPerAddressTreeKey(baseSeed, addressIndex);
    return treeKey.getPublicKey();
}
/**
 * Get the address public key from a per-address TreeKey
 *
 * In the per-address architecture, each address has its own TreeKey,
 * and the address public key is simply the TreeKey's root public key.
 *
 * @param treeKey - Per-address TreeKey
 * @returns 32-byte address public key (TreeKey root)
 */
function getPerAddressPublicKey(treeKey) {
    return treeKey.getPublicKey();
}
