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

import { sha3_256 } from '@noble/hashes/sha3.js';
import { deriveChainSeedJava, hashObject, serializeMiniNumber, serializeMiniData, deriveRootPrivSeed, deriveUnifiedChildSeed, derivePerAddressSeed } from './javaStreamables.js';
import { derivePKdigest, deriveFullPublicKey, wotsSign, wotsVerifyDigest, hex } from './wots.js';
import { getParamSet } from './params.js';
import { 
  MMRTree, 
  MMRProof, 
  createMMRDataLeafNode, 
  calculateProofRoot,
  serializeMMRProof,
  parseMMRProofFromHex,
  Bytes 
} from './mmr.js';
import { 
  writeSignature,
  type Signature as StreamableSignature,
  type SignatureProof as StreamableSignatureProof
} from './Streamable.js';
import type { LoggerAdapter } from './adapters/index.js';
import { NoopLogger } from './adapters/index.js';

// Module-level debug logger - can be set externally for parity testing
let treeKeyLogger: LoggerAdapter = new NoopLogger();
let treeKeyDebugEnabled = false;

/**
 * Enable TreeKey debug logging with a custom logger
 * Use this for parity testing to capture wallet init intermediate values
 * 
 * WARNING: Debug logging outputs sensitive cryptographic material including
 * seeds and private key derivation. NEVER enable in production builds.
 * This is intended for development/testing parity verification only.
 */
export function setTreeKeyLogger(logger: LoggerAdapter): void {
  treeKeyLogger = logger;
  treeKeyDebugEnabled = true;
}

/**
 * Disable TreeKey debug logging
 */
export function disableTreeKeyLogger(): void {
  treeKeyLogger = new NoopLogger();
  treeKeyDebugEnabled = false;
}

/**
 * Check if TreeKey debug logging is enabled
 */
export function isTreeKeyDebugEnabled(): boolean {
  return treeKeyDebugEnabled;
}

export const DEFAULT_KEYS_PER_LEVEL = 64;
export const DEFAULT_LEVELS = 3;

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
  leafPubkey: Bytes;      // 32-byte WOTS public key DIGEST (SHA3-256 of full key) - matches Java
  signature: Bytes;       // L×32-byte Winternitz signature (1088 bytes for L=34)
  mmrProof: MMRProof;     // MMR proof from leaf to root
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
export function getRootPublicKey(proof: SignatureProof): Bytes {
  const leafData = createMMRDataLeafNode(proof.leafPubkey, 0n);
  return calculateProofRoot(leafData, proof.mmrProof);
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
export class TreeKeyNode {
  private seed: Bytes;
  private childSeed: Bytes;
  private keysPerLevel: number;
  private publicKeyDigests: Bytes[]; // 32-byte SHA3 digests - matches Java's Winternitz.getPublicKey() which returns SHA3-256(full_key)
  private mmrTree: MMRTree;
  private rootPubkey: Bytes;
  private childCache: Map<number, TreeKeyNode> = new Map();
  
  constructor(privateSeed: Bytes, keysPerLevel: number = DEFAULT_KEYS_PER_LEVEL) {
    if (privateSeed.length !== 32) {
      throw new Error('Private seed must be 32 bytes');
    }
    
    if (treeKeyDebugEnabled) {
      treeKeyLogger.debug(`[TreeKeyNode] ========== INIT START ==========`);
      treeKeyLogger.debug(`[TreeKeyNode] Private seed: ${hex(privateSeed)}`);
      treeKeyLogger.debug(`[TreeKeyNode] Keys per level: ${keysPerLevel}`);
    }
    
    this.seed = privateSeed;
    this.keysPerLevel = keysPerLevel;
    
    // Hash the seed to create child seed (for deriving child nodes)
    // From TreeKeyNode.java: mChildSeed = Crypto.getInstance().hashObject(zPrivateSeed);
    // hashObject serializes as MiniData (length-prefixed) then hashes
    this.childSeed = hashObject(privateSeed);
    
    if (treeKeyDebugEnabled) {
      treeKeyLogger.debug(`[TreeKeyNode] Child seed (hashObject): ${hex(this.childSeed)}`);
    }
    
    // Generate all Winternitz public key DIGESTS (32 bytes each)
    // Java's Winternitz.getPublicKey() returns SHA3-256(full_key) = 32 bytes
    // See WinternitzOTSignature.getPublicKey() lines 103-121: hashes full 1088B key, returns 32B digest
    // TreeKeyNode.java line 53: MiniData pubkey = wots.getPublicKey() - stores the 32B digest
    // MMRData.CreateMMRDataLeafNode(pubkey, MiniNumber.ZERO) - builds leaves from digests
    this.publicKeyDigests = [];
    for (let i = 0; i < keysPerLevel; i++) {
      // Digest (32 bytes) - used for MMR tree, SignatureProof.leafPubkey, and address derivation
      const pkDigest = derivePKdigest(privateSeed, i, getParamSet());
      this.publicKeyDigests.push(pkDigest);
      
      // Log first few keys for debugging
      if (treeKeyDebugEnabled && i < 3) {
        treeKeyLogger.debug(`[TreeKeyNode] WOTS key[${i}] digest (32B): ${hex(pkDigest)}`);
      }
    }
    
    if (treeKeyDebugEnabled) {
      treeKeyLogger.debug(`[TreeKeyNode] Generated ${this.publicKeyDigests.length} WOTS key digests`);
      const lastIdx = this.publicKeyDigests.length - 1;
      treeKeyLogger.debug(`[TreeKeyNode] WOTS key[${lastIdx}] digest: ${hex(this.publicKeyDigests[lastIdx])}`);
    }
    
    // Build MMR tree from 32-byte PUBLIC KEY DIGESTS (Java-compatible)
    // Java's TreeKeyNode: MMRData.CreateMMRDataLeafNode(wots.getPublicKey(), ZERO)
    // where getPublicKey() returns SHA3-256(full_key) = 32-byte DIGEST
    this.mmrTree = MMRTree.fromPublicKeys(this.publicKeyDigests);
    
    // Root public key = MMR root
    const root = this.mmrTree.getRoot();
    if (!root) {
      throw new Error('Failed to compute MMR root');
    }
    this.rootPubkey = root.data;
    
    if (treeKeyDebugEnabled) {
      treeKeyLogger.debug(`[TreeKeyNode] MMR root (node public key): ${hex(this.rootPubkey)}`);
      treeKeyLogger.debug(`[TreeKeyNode] ========== INIT END ==========`);
    }
  }
  
  /**
   * Async factory method for TreeKeyNode with progress reporting
   * Yields to event loop every few keys to keep UI responsive
   */
  static async createWithProgress(
    privateSeed: Bytes,
    keysPerLevel: number = DEFAULT_KEYS_PER_LEVEL,
    onProgress?: ProgressCallback
  ): Promise<TreeKeyNode> {
    if (privateSeed.length !== 32) {
      throw new Error('Private seed must be 32 bytes');
    }
    
    const node = Object.create(TreeKeyNode.prototype) as TreeKeyNode;
    node.seed = privateSeed;
    node.keysPerLevel = keysPerLevel;
    node.childSeed = hashObject(privateSeed);
    node.publicKeyDigests = [];
    node.childCache = new Map();
    
    // Generate Winternitz public key DIGESTS with progress (32 bytes each)
    // Java's Winternitz.getPublicKey() returns SHA3-256(full_key) = 32 bytes
    // See WinternitzOTSignature.getPublicKey() lines 103-121: hashes full 1088B key, returns 32B digest
    for (let i = 0; i < keysPerLevel; i++) {
      // Digest (32 bytes) - used for MMR tree, SignatureProof.leafPubkey, and address derivation
      const pkDigest = derivePKdigest(privateSeed, i, getParamSet());
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
    node.mmrTree = MMRTree.fromPublicKeys(node.publicKeyDigests);
    
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
  getPublicKey(): Bytes {
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
  getWOTSPublicKey(index: number): Bytes {
    if (index < 0 || index >= this.keysPerLevel) {
      throw new Error(`Key index ${index} out of range [0, ${this.keysPerLevel})`);
    }
    // Derive on-demand - expensive but only used for tests
    return deriveFullPublicKey(this.seed, index, getParamSet());
  }
  
  /**
   * Get the Winternitz public key digest at a specific index (0-63)
   * Returns the 32-byte SHA3 hash of the full public key
   */
  getWOTSPublicKeyDigest(index: number): Bytes {
    if (index < 0 || index >= this.keysPerLevel) {
      throw new Error(`Key index ${index} out of range [0, ${this.keysPerLevel})`);
    }
    return this.publicKeyDigests[index];
  }
  
  /**
   * Get the MMR proof for a specific key index
   */
  getProof(keyIndex: number): MMRProof {
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
  sign(keyIndex: number, data: Bytes): SignatureProof {
    if (keyIndex < 0 || keyIndex >= this.keysPerLevel) {
      throw new Error(`Key index ${keyIndex} out of range [0, ${this.keysPerLevel})`);
    }
    
    if (treeKeyDebugEnabled) {
      treeKeyLogger.debug(`[TreeKeyNode.sign] ========== SIGN START ==========`);
      treeKeyLogger.debug(`[TreeKeyNode.sign] keyIndex: ${keyIndex}`);
      treeKeyLogger.debug(`[TreeKeyNode.sign] input data (${data.length}B): ${hex(data).substring(0, 64)}${data.length > 32 ? '...' : ''}`);
    }
    
    // Get the 32-byte Winternitz public key DIGEST for SignatureProof
    // CRITICAL FIX: Java's Winternitz.getPublicKey() returns SHA3-256(full_key) = 32 bytes!
    // NOT the 1088-byte full key! This was the bug causing "allsignaturesvalid":false errors.
    const leafPubkey = this.publicKeyDigests[keyIndex];
    
    if (treeKeyDebugEnabled) {
      treeKeyLogger.debug(`[TreeKeyNode.sign] leafPubkey (${leafPubkey.length}B DIGEST): ${hex(leafPubkey)}`);
    }
    
    // CRITICAL: Do NOT pre-hash here! wotsSign() now handles internal hashing (matching Java/BouncyCastle).
    // Java's WinternitzOTSignature.getSignature() hashes internally, so wotsSign() does too.
    // Call sites pass the same 32-byte values Java passes:
    //   - For TX signing: the 32-byte transaction digest
    //   - For parent→child: the 32-byte childRoot (MMR root of child proof)
    // WOTS hashes once internally - this is by design for Minima compatibility.
    
    if (treeKeyDebugEnabled) {
      treeKeyLogger.debug(`[TreeKeyNode.sign] dataToSign (raw input, WOTS hashes internally): ${hex(data)}`);
    }
    
    // Sign data directly - wotsSign() handles internal hashing
    const signature = wotsSign(this.seed, keyIndex, data, getParamSet());
    
    if (treeKeyDebugEnabled) {
      treeKeyLogger.debug(`[TreeKeyNode.sign] signature (${signature.length}B): ${hex(signature).substring(0, 64)}...${hex(signature).substring(hex(signature).length - 32)}`);
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
  getChild(childIndex: number): TreeKeyNode {
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
      treeKeyLogger.debug(`[TreeKeyNode.getChild] Parent childSeed: ${hex(this.childSeed)}`);
    }
    
    // From TreeKeyNode.java:
    // MiniData seed = Crypto.getInstance().hashAllObjects(new MiniNumber(zChild), mChildSeed);
    const childSeed = deriveChainSeedJava(this.childSeed, childIndex);
    
    if (treeKeyDebugEnabled) {
      treeKeyLogger.debug(`[TreeKeyNode.getChild] Derived childSeed: ${hex(childSeed)}`);
    }
    
    const child = new TreeKeyNode(childSeed, this.keysPerLevel);
    
    if (treeKeyDebugEnabled) {
      treeKeyLogger.debug(`[TreeKeyNode.getChild] Child public key: ${hex(child.getPublicKey())}`);
    }
    
    // Cache for future use
    this.childCache.set(childIndex, child);
    
    return child;
  }
}

/**
 * TreeKey - Full hierarchical key tree with multiple levels
 * 
 * Matches TreeKey.java:
 * - Default: 3 levels x 64 keys = 262,144 one-time signatures
 * - Tracks usage count to determine which key to use
 * - Produces multi-level signatures
 */
export class TreeKey {
  private privateSeed: Bytes;
  private levels: number;
  private keysPerLevel: number;
  private root: TreeKeyNode;
  private publicKey: Bytes;
  private uses: number = 0;
  
  /**
   * Parent-child signature cache for efficiency
   * Key format: "l1" for root->level1, "l1,l2" for level1->level2
   * Value: SignatureProof for parent signing child's pubkey
   */
  private parentChildSigCache: Map<string, SignatureProof> = new Map();
  
  constructor(privateSeed: Bytes, keysPerLevel: number = DEFAULT_KEYS_PER_LEVEL, levels: number = DEFAULT_LEVELS) {
    if (privateSeed.length !== 32) {
      throw new Error('Private seed must be 32 bytes');
    }
    
    if (treeKeyDebugEnabled) {
      treeKeyLogger.debug(`[TreeKey] ========== WALLET INIT START ==========`);
      treeKeyLogger.debug(`[TreeKey] Private seed: ${hex(privateSeed)}`);
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
      treeKeyLogger.debug(`[TreeKey] Root public key: ${hex(this.publicKey)}`);
      treeKeyLogger.debug(`[TreeKey] ========== WALLET INIT END ==========`);
    }
  }
  
  /**
   * Async factory method for TreeKey with progress reporting
   * Reports progress as the root TreeKeyNode generates its 64 signing keys
   */
  static async createWithProgress(
    privateSeed: Bytes,
    keysPerLevel: number = DEFAULT_KEYS_PER_LEVEL,
    levels: number = DEFAULT_LEVELS,
    onProgress?: ProgressCallback
  ): Promise<TreeKey> {
    if (privateSeed.length !== 32) {
      throw new Error('Private seed must be 32 bytes');
    }
    
    const treeKey = Object.create(TreeKey.prototype) as TreeKey;
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
  getRootNode(): TreeKeyNode {
    return this.root;
  }
  
  /**
   * Get the root public key (for watermark tracking)
   */
  getRootPublicKey(): Bytes {
    return this.publicKey;
  }
  
  /**
   * Get the wallet's public key (root of the key tree)
   */
  getPublicKey(): Bytes {
    return this.publicKey;
  }
  
  /**
   * Get the maximum number of signatures this tree can produce
   */
  getMaxUses(): number {
    return Math.pow(this.keysPerLevel, this.levels);
  }
  
  /**
   * Get current usage count
   */
  getUses(): number {
    return this.uses;
  }
  
  /**
   * Set the usage counter (for resuming from a known state)
   */
  setUses(uses: number): void {
    this.uses = uses;
  }
  
  /**
   * Generate cache key for parent-child signature
   * @param path - Array of indices leading to the child (e.g., [l1] or [l1, l2])
   */
  private getCacheKey(path: number[]): string {
    return path.join(',');
  }
  
  /**
   * Check if a parent-child signature is cached
   * @param path - Array of indices (e.g., [l1] for root->level1)
   */
  hasParentChildSig(path: number[]): boolean {
    return this.parentChildSigCache.has(this.getCacheKey(path));
  }
  
  /**
   * Get a cached parent-child signature
   * @param path - Array of indices (e.g., [l1] for root->level1)
   */
  getParentChildSig(path: number[]): SignatureProof | undefined {
    return this.parentChildSigCache.get(this.getCacheKey(path));
  }
  
  /**
   * Cache a parent-child signature for reuse
   * This allows the same signature to be reused across multiple signing operations
   * 
   * @param path - Array of indices leading to the child (e.g., [l1] or [l1, l2])
   * @param sig - SignatureProof from parent signing child's public key
   */
  setParentChildSig(path: number[], sig: SignatureProof): void {
    this.parentChildSigCache.set(this.getCacheKey(path), sig);
  }
  
  /**
   * Get all cached parent-child signatures (for serialization/persistence)
   */
  getCachedSignatures(): Map<string, SignatureProof> {
    return new Map(this.parentChildSigCache);
  }
  
  /**
   * Restore cached signatures (for hydrating from persistence)
   */
  restoreCachedSignatures(cache: Map<string, SignatureProof>): void {
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
  private baseConversion(num: number): number[] {
    const result: number[] = [];
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
  sign(data: Bytes): TreeSignature {
    if (this.uses >= this.getMaxUses()) {
      throw new Error('No more keys available (tree exhausted)');
    }
    
    // Get the path through the tree
    const path = this.baseConversion(this.uses);
    
    // Navigate to all nodes first
    const nodes: TreeKeyNode[] = [this.root];
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
    
    const proofs: SignatureProof[] = new Array(this.levels);
    
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
        sigProof = parentNode.sign(keyIndex, childRoot);  // Sign the 32-byte MMR root!
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
  getAddressPublicKey(l1: number): Bytes {
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
  getSigningNodePublicKey(l1: number, l2: number): Bytes {
    // Navigate to level 2 node
    const level1Node = this.root.getChild(l1);
    const level2Node = level1Node.getChild(l2);
    return level2Node.getPublicKey();
  }
}

/**
 * Verify a tree signature against expected public key and data
 * 
 * Matches TreeKey.java verify():
 * - First proof's computed root must match expected public key
 * - Each intermediate proof must sign the next level's root
 * - Final proof must verify against the actual data
 */
export function verifyTreeSignature(
  expectedPubkey: Bytes, 
  data: Bytes, 
  signature: TreeSignature
): boolean {
  const { proofs } = signature;
  
  if (proofs.length === 0) {
    return false;
  }
  
  // Import wotsVerify for verification
  // wotsVerify already imported at top of file
  const paramSet = getParamSet();
  
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
    let signedData: Bytes;
    if (depth === proofs.length - 1) {
      // Final level: signed the actual data
      signedData = data;
    } else {
      // Intermediate level: signed the next level's root public key
      signedData = getRootPublicKey(proofs[depth + 1]);
    }
    
    // Verify the Winternitz signature
    // Use wotsVerifyDigest since leafPubkey is now a 32-byte digest (not 1088-byte full key)
    if (!wotsVerifyDigest(proof.signature, signedData, proof.leafPubkey, paramSet)) {
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
export function serializeTreeSignature(sig: TreeSignature): Bytes {
  // Convert to Streamable format (adds blockTime to MMRProof)
  const streamableSig: StreamableSignature = {
    proofs: sig.proofs.map(proof => ({
      leafPubkey: proof.leafPubkey,
      signature: proof.signature,
      mmrProof: {
        blockTime: 0n,  // Default for compatibility
        chunks: proof.mmrProof.chunks
      }
    }))
  };
  
  // Use canonical serializer for byte-exact Java compatibility
  return writeSignature(streamableSig);
}

/**
 * Deserialize a TreeSignature from bytes
 * 
 * Matches Java's Signature.readDataStream():
 * - Number of proofs: MiniNumber format
 * - Each SignatureProof: MiniData(pubkey) + MiniData(signature) + MMRProof
 */
export function deserializeTreeSignature(data: Bytes): TreeSignature {
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
  
  const proofs: SignatureProof[] = [];
  
  for (let i = 0; i < numProofs; i++) {
    // Leaf pubkey - MiniData format (4-byte length prefix + data)
    const pubkeyLen = (data[offset] << 24) | (data[offset+1] << 16) | (data[offset+2] << 8) | data[offset+3];
    offset += 4;
    const leafPubkey = data.slice(offset, offset + pubkeyLen);
    offset += pubkeyLen;
    
    // Signature - MiniData format (4-byte length prefix + data)
    const sigLen = (data[offset] << 24) | (data[offset+1] << 16) | (data[offset+2] << 8) | data[offset+3];
    offset += 4;
    const signature = data.slice(offset, offset + sigLen);
    offset += sigLen;
    
    // MMR proof - returns { proof, blockTime, bytesRead }
    const { proof: mmrProof, bytesRead: mmrProofLen } = parseMMRProofFromHex(data.slice(offset));
    offset += mmrProofLen;
    
    proofs.push({ leafPubkey, signature, mmrProof });
  }
  
  return { proofs };
}

/**
 * ============================================================================
 * UNIFIED TREEKEY FACTORY
 * ============================================================================
 *
 * Single hierarchical derivation scheme:
 *
 *   root_priv_seed  = deriveRootPrivSeed(baseSeed)
 *   child_seed_i    = deriveUnifiedChildSeed(baseSeed, i)
 *   child_treekey_i = new TreeKey(child_seed_i, 64, 3)   ← spend address i
 *   root_treekey    = new TreeKey(root_priv_seed, 64, 3)  ← identity anchor
 *
 * Child seeds are cryptographically descended from root_priv_seed, not siblings.
 * Addresses are Minima-compatible (RETURN SIGNEDBY(pubkey) scripts, WOTS sigs).
 * The root TreeKey is NEVER used as a spend address.
 *
 * Signature capacity: 64 addresses × 4 096 signatures each = 262 144 total.
 * Root identity capacity: 4 096 attestation signatures.
 * ============================================================================
 */

/**
 * Create the unified child TreeKey for spend address at `index`.
 *
 * Derivation: child_seed_i = deriveUnifiedChildSeed(baseSeed, i)
 *             treeKey = new TreeKey(child_seed_i, 64, 3)
 *
 * @param baseSeed - 32-byte wallet base seed (from mnemonic)
 * @param index - Address index (0-63)
 * @returns TreeKey for this spend address with size=64, depth=3
 */
export function createUnifiedChildTreeKey(baseSeed: Bytes, index: number): TreeKey {
  const childSeed = deriveUnifiedChildSeed(baseSeed, index);
  return new TreeKey(childSeed, 64, 3);
}

/**
 * Async version with progress reporting for UI.
 *
 * @param baseSeed - 32-byte wallet base seed
 * @param index - Address index (0-63)
 * @param onProgress - Optional progress callback
 * @returns Promise resolving to the child TreeKey
 */
export async function createUnifiedChildTreeKeyAsync(
  baseSeed: Bytes,
  index: number,
  onProgress?: ProgressCallback
): Promise<TreeKey> {
  const childSeed = deriveUnifiedChildSeed(baseSeed, index);
  return TreeKey.createWithProgress(childSeed, 64, 3, onProgress);
}

/**
 * Create the unified root identity TreeKey (identity anchor, never a spend address).
 *
 * Derivation: root_priv_seed = deriveRootPrivSeed(baseSeed)
 *             treeKey = new TreeKey(root_priv_seed, 64, 3)
 *
 * @param baseSeed - 32-byte wallet base seed (from mnemonic)
 * @returns Root identity TreeKey with size=64, depth=3
 */
export function createUnifiedRootTreeKey(baseSeed: Bytes): TreeKey {
  const rootPrivSeed = deriveRootPrivSeed(baseSeed);
  return new TreeKey(rootPrivSeed, 64, 3);
}

/**
 * Fast path for deriving a child address public key without constructing
 * the full TreeKey. Useful during wallet initialisation.
 *
 * @param baseSeed - 32-byte wallet base seed
 * @param index - Address index (0-63)
 * @returns 32-byte address public key (MMR root of child TreeKey)
 */
export function deriveUnifiedAddressPublicKey(baseSeed: Bytes, index: number): Bytes {
  return createUnifiedChildTreeKey(baseSeed, index).getPublicKey();
}

// ---------------------------------------------------------------------------
// Deprecated aliases — kept for migration compatibility only.
// Downstream consumers should migrate to createUnifiedChildTreeKey.
// ---------------------------------------------------------------------------

/**
 * @deprecated Use {@link createUnifiedChildTreeKey} instead.
 * This wrapper preserves the LEGACY per-address seed derivation
 * (`SHA3-256(baseSeed ‖ indexBytes(i))`) so that existing callers
 * that import this symbol by name continue to derive the same keys.
 * New code must use createUnifiedChildTreeKey which applies the unified
 * two-step derivation (root_priv_seed → child_seed_i).
 */
export function createPerAddressTreeKey(baseSeed: Bytes, addressIndex: number): TreeKey {
  const perAddressSeed = derivePerAddressSeed(baseSeed instanceof Uint8Array ? baseSeed : new Uint8Array(baseSeed), addressIndex);
  return new TreeKey(perAddressSeed, 64, 3);
}

/**
 * @deprecated Use {@link createUnifiedChildTreeKeyAsync} instead.
 * Preserves legacy per-address seed derivation for backward compatibility.
 */
export async function createPerAddressTreeKeyAsync(
  baseSeed: Bytes,
  addressIndex: number,
  onProgress?: ProgressCallback
): Promise<TreeKey> {
  const perAddressSeed = derivePerAddressSeed(baseSeed instanceof Uint8Array ? baseSeed : new Uint8Array(baseSeed), addressIndex);
  return TreeKey.createWithProgress(perAddressSeed, 64, 3, onProgress);
}
