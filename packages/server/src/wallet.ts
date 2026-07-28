/**
 * High-level wallet interface for Node.js
 * 
 * MINIMA-COMPATIBLE WALLET (2026-02-05)
 * ======================================
 * 
 * This wallet implementation now matches Minima's Wallet.java exactly:
 * 
 * 1. Seed Derivation: SHA3-256(cleaned mnemonic phrase) 
 *    - Uses phraseToSeed() from @totemsdk/core
 *    - Matches Minima BIP39.convertStringToSeed()
 * 
 * 2. Per-Address TreeKey Architecture:
 *    - Each address has its own independent TreeKey (size=64, depth=3)
 *    - Address seed = hashObjects(baseSeed, MiniData(BigInteger(index)))
 *    - Uses derivePerAddressSeed() from javaStreamables.ts
 * 
 * 3. Address Public Key:
 *    - Is the per-address TreeKey's MMR root (not a child key)
 *    - Uses deriveAddressPublicKey() from treekey.ts
 * 
 * 4. Signing:
 *    - Uses TreeKey hierarchical signatures with proofs
 *    - Produces 3 signature proofs per transaction (Root→L1→L2→DATA)
 * 
 * Signature Capacity: 64 addresses × 4,096 signatures each = 262,144 total
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as core from '@totemsdk/core';
import {
  mineTxPoW,
  fetchTxPowTarget,
  serializeTxBody as sdkSerializeTxBody,
  type MineResult,
} from '@totemsdk/txpow';

export interface WalletConfig {
  client: MinimaClient;
  storagePath?: string;
  password?: string;
}

export interface Account {
  address: string;
  publicKey: string;
  index: number;
  balance?: string;
}

export interface MinimaClient {
  getBalance(address: string): Promise<string>;
  buildTransaction(params: TransactionParams): Promise<Transaction>;
  submitTransaction(txData: string): Promise<string>;
}

export interface TransactionParams {
  from: string;
  to: string;
  amount: string;
  fee?: string;
}

export interface Transaction {
  inputs?: unknown[];
  outputs?: unknown[];
  signature?: string;
  witness?: string;
}


/**
 * Minima-compatible wallet for Node.js
 * 
 * Uses per-address TreeKey architecture matching Minima Wallet.java exactly.
 */
export class MinimaWallet {
  private client: MinimaClient;
  private storagePath: string;
  private password?: string;
  private baseSeed?: Uint8Array;
  private accounts: Map<string, Account> = new Map();
  private currentIndex: number = 0;
  
  // Cache for per-address TreeKeys (expensive to create)
  private treeKeyCache: Map<number, core.TreeKey> = new Map();
  
  // Maximum addresses (matches Minima Wallet.java)
  static readonly MAX_ADDRESSES = 64;

  constructor(config: WalletConfig) {
    this.client = config.client;
    this.storagePath = config.storagePath || path.join(process.cwd(), '.minima-wallet');
    this.password = config.password;
  }

  /**
   * Initialize wallet with new seed phrase or load existing
   * 
   * @param seedPhrase - 24-word Minima seed phrase (optional, creates new if not provided)
   */
  async initialize(seedPhrase?: string): Promise<void> {
    if (seedPhrase) {
      // Create new wallet from seed phrase
      // Uses SHA3-256 hash of cleaned phrase - matches Minima BIP39
      this.baseSeed = core.phraseToSeed(seedPhrase);
      await this.save();
    } else {
      // Load existing wallet
      await this.load();
    }

    // Generate initial accounts
    await this.generateAccounts(5);
  }

  /**
   * Generate new Minima-compatible seed phrase
   * 
   * @returns 24-word seed phrase in UPPERCASE (Minima canonical form)
   */
  generateSeedPhrase(): string {
    return core.generateSeedPhrase();
  }

  /**
   * Validate a seed phrase
   * 
   * @param phrase - Seed phrase to validate
   * @returns true if all words are valid BIP39 words
   */
  validateSeedPhrase(phrase: string): boolean {
    return core.validatePhrase(phrase);
  }

  /**
   * Create new account using per-address TreeKey architecture
   * 
   * Matches Minima Wallet.createNewKey() exactly:
   * 1. modifier = new MiniData(new BigInteger(Integer.toString(numkeys)))
   * 2. privseed = Crypto.hashObjects(baseSeed, modifier)
   * 3. treekey = TreeKey.createDefault(privseed)
   * 4. address public key = TreeKey's MMR root
   */
  async createAccount(label?: string): Promise<Account> {
    if (!this.baseSeed) throw new Error('Wallet not initialized');
    if (this.currentIndex >= MinimaWallet.MAX_ADDRESSES) {
      throw new Error(`Maximum addresses (${MinimaWallet.MAX_ADDRESSES}) reached`);
    }

    const index = this.currentIndex++;
    
    // Derive address using per-address TreeKey architecture
    const { address, publicKey } = this.deriveAddressFromSeed(this.baseSeed, index);

    const account: Account = {
      address,
      publicKey,
      index
    };

    this.accounts.set(address, account);
    await this.save();

    return account;
  }

  /**
   * Get all accounts
   */
  getAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Get account by address
   */
  getAccount(address: string): Account | undefined {
    return this.accounts.get(address);
  }

  /**
   * Get account by index
   */
  getAccountByIndex(index: number): Account | undefined {
    for (const account of this.accounts.values()) {
      if (account.index === index) return account;
    }
    return undefined;
  }

  /**
   * Update account balances from network
   */
  async updateBalances(): Promise<void> {
    for (const account of this.accounts.values()) {
      account.balance = await this.client.getBalance(account.address);
    }
  }

  /**
   * Sign transaction using per-address TreeKey
   * 
   * CRITICAL: WOTS ONE-TIME KEY REQUIREMENT
   * ========================================
   * WOTS (Winternitz One-Time Signature) keys MUST only be used once.
   * Reusing the same (l1, l2) indices for different messages compromises
   * the private key and allows signature forgery.
   * 
   * The caller MUST provide unique signingIndices for each transaction.
   * Use a WatermarkStore or similar mechanism to track used indices.
   * Each per-address TreeKey supports 64 × 64 = 4,096 unique signatures.
   * 
   * CRITICAL FIX (2026-02-05): Now uses setUses() + sign() to produce 3 proofs
   * matching Java's TreeKey.sign() exactly for depth=3 TreeKeys.
   * The (l1, l2) indices are converted to a uses counter: uses = l1 * 64 + l2
   * 
   * Uses hierarchical TreeKey signatures:
   * - setUses(uses) + sign() produces 3 signature proofs (Root→L1→L2→DATA)
   * - l1 range: 0-63 (L1 index)
   * - l2 range: 0-63 (L2 index within L1 subtree)
   * 
   * NOTE: Transaction serialization currently uses JSON. For full Minima
   * compatibility, provide pre-hashed transaction data via signData().
   * 
   * @param tx - Transaction to sign
   * @param fromAddress - Address to sign from
   * @param signingIndices - REQUIRED in production: unique (l1, l2) indices
   * @returns Hex-encoded signature
   * @throws Error if indices are not provided (in production mode)
   */
  async signTransaction(
    tx: Transaction, 
    fromAddress: string,
    signingIndices: { l1: number; l2: number }
  ): Promise<string> {
    if (!this.baseSeed) throw new Error('Wallet not initialized');
    
    const account = this.accounts.get(fromAddress);
    if (!account) throw new Error('Account not found');

    const treeKey = await this.getOrCreateTreeKey(account.index);
    
    const { l1, l2 } = signingIndices;
    if (l1 < 0 || l1 >= 64) throw new Error(`Invalid l1 index ${l1}: must be 0-63`);
    if (l2 < 0 || l2 >= 64) throw new Error(`Invalid l2 index ${l2}: must be 0-63`);
    
    const txData = this.serializeTransaction(tx);
    const txHash = crypto.createHash('sha3-256').update(txData).digest();
    const txHashBytes = new Uint8Array(txHash);
    
    const KEYS_PER_LEVEL = 64;
    const uses = l1 * KEYS_PER_LEVEL + l2;
    treeKey.setUses(uses);
    const signature = treeKey.sign(txHashBytes);
    
    const serialized = core.serializeTreeSignature(signature);
    return core.bytesToHex(serialized);
  }

  /**
   * Sign a MinimaTransaction using canonical Minima wire serialization.
   * 
   * This is the production-ready signing method that matches the Totem wallet extension exactly:
   * 1. Precomputes output coin IDs (matching Java's TxPoWGenerator.precomputeTransactionCoinID)
   * 2. Serializes the transaction using Minima's canonical wire format (Streamable.ts)
   * 3. Computes SHA3-256 digest of the serialized bytes
   * 4. Signs with TreeKey hierarchical WOTS signatures
   * 
   * @param tx - MinimaTransaction with proper MinimaCoin inputs/outputs
   * @param addressIndex - Account index (0-63) to sign with
   * @param signingIndices - Unique (l1, l2) indices for this one-time signature
   * @returns Hex-encoded hierarchical TreeKey signature
   */
  async signMinimaTransaction(
    tx: core.MinimaTransaction,
    addressIndex: number,
    signingIndices: { l1: number; l2: number }
  ): Promise<{ signature: string; digest: Uint8Array }> {
    if (!this.baseSeed) throw new Error('Wallet not initialized');

    const { l1, l2 } = signingIndices;
    if (l1 < 0 || l1 >= 64) throw new Error(`Invalid l1 index ${l1}: must be 0-63`);
    if (l2 < 0 || l2 >= 64) throw new Error(`Invalid l2 index ${l2}: must be 0-63`);

    core.precomputeTransactionCoinIDTx(tx);

    const digest = core.computeTransactionDigest(tx);

    const treeKey = await this.getOrCreateTreeKey(addressIndex);
    const KEYS_PER_LEVEL = 64;
    const uses = l1 * KEYS_PER_LEVEL + l2;
    treeKey.setUses(uses);
    const sig = treeKey.sign(digest);

    const serialized = core.serializeTreeSignature(sig);
    return {
      signature: core.bytesToHex(serialized),
      digest,
    };
  }

  /**
   * Sign raw data hash using per-address TreeKey
   * 
   * This is the low-level signing method that accepts pre-computed hash.
   * Use this for full Minima compatibility where transaction hashing
   * follows Minima's canonical serialization.
   * 
   * CRITICAL FIX (2026-02-05): Now uses setUses() + sign() to produce 3 proofs
   * matching Java's TreeKey.sign() exactly for depth=3 TreeKeys.
   * 
   * @param dataHash - 32-byte SHA3-256 hash of data to sign
   * @param addressIndex - Account index (0-63)
   * @param signingIndices - Unique (l1, l2) indices for this signature
   * @returns Hex-encoded signature
   */
  async signData(
    dataHash: Uint8Array,
    addressIndex: number,
    signingIndices: { l1: number; l2: number }
  ): Promise<string> {
    if (!this.baseSeed) throw new Error('Wallet not initialized');
    if (dataHash.length !== 32) throw new Error('Data hash must be 32 bytes');
    
    const treeKey = await this.getOrCreateTreeKey(addressIndex);
    
    const { l1, l2 } = signingIndices;
    if (l1 < 0 || l1 >= 64) throw new Error(`Invalid l1 index ${l1}: must be 0-63`);
    if (l2 < 0 || l2 >= 64) throw new Error(`Invalid l2 index ${l2}: must be 0-63`);
    
    // CRITICAL FIX (2026-02-05): Use setUses() + sign() for 3 proofs matching Java
    // Convert (l1, l2) indices to uses counter: uses = l1 * 64 + l2
    const KEYS_PER_LEVEL = 64;
    const uses = l1 * KEYS_PER_LEVEL + l2;
    treeKey.setUses(uses);
    const signature = treeKey.sign(dataHash);
    
    const serialized = core.serializeTreeSignature(signature);
    return core.bytesToHex(serialized);
  }

  /**
   * Send transaction with automatic signing
   * 
   * WARNING: This convenience method is NOT suitable for production use.
   * Production code must:
   * 1. Track used signing indices via WatermarkStore
   * 2. Use signData() with proper Minima transaction serialization
   * 3. Build witness bundle correctly for txnimport
   * 
   * @param params - Transaction parameters
   * @param signingIndices - Required: unique (l1, l2) indices for this signature
   */
  async sendTransaction(
    params: TransactionParams,
    signingIndices: { l1: number; l2: number }
  ): Promise<string> {
    // Build transaction
    const tx = await this.client.buildTransaction(params);
    
    // Sign transaction with provided indices
    const signature = await this.signTransaction(tx, params.from, signingIndices);
    tx.signature = signature;
    
    // Submit to network
    const txId = await this.client.submitTransaction(JSON.stringify(tx));
    
    return txId;
  }

  /**
   * Mine a TxPoW locally and submit it to the Axia API.
   *
   * This is the production path for SDK-built transactions:
   *   1. Fetch the live difficulty target from the Axia API.
   *   2. Build the TxBody (serialized tx + witness bytes).
   *   3. Iterate the nonce until SHA3-256(TxHeader) < target (JS mining loop).
   *   4. POST the mined TxPoW hex to the Axia MEG bridge for p2p broadcast.
   *
   * The caller is responsible for building and signing the transaction
   * (e.g. via @totemsdk/tx-builder) to produce txBytes + witnessBytes.
   *
   * @param txBytes       Pre-serialized, signed Transaction bytes.
   *                      Use core.serializeTransaction(tx) after signing.
   * @param witnessBytes  Pre-serialized Witness bytes (WOTS proofs + coin proofs).
   *                      Use your witness serializer (extension or SDK equivalent).
   * @param opts          Optional: axiaBaseUrl override, AbortSignal, mining chunk size.
   * @returns             txpowId (hex), mining source, and wall-clock time.
   */
  async mineAndSubmitTxPoW(
    txBytes: Uint8Array,
    witnessBytes: Uint8Array,
    opts?: {
      axiaBaseUrl?: string;
      signal?: AbortSignal;
      chunkSize?: number;
      submitPath?: string;
    }
  ): Promise<{ txpowId: string; miningSource: MineResult['source']; elapsedMs: number }> {
    if (!opts?.axiaBaseUrl) {
      throw new Error('mineAndSubmitTxPoW: opts.axiaBaseUrl is required');
    }
    const baseUrl = opts.axiaBaseUrl.replace(/\/$/, '');
    const submitPath = opts?.submitPath ?? '/api/meg/postminedtxn';

    const target = await fetchTxPowTarget(baseUrl);

    const txBodyBytes = sdkSerializeTxBody(txBytes, witnessBytes, { txnDifficulty: target });

    const mineResult = await mineTxPoW(txBodyBytes, target, {
      signal: opts?.signal,
      chunkSize: opts?.chunkSize,
    });

    const hasBody = new Uint8Array([0x01]);
    const txpowLength = mineResult.minedHeaderBytes.length + 1 + txBodyBytes.length;
    const txpowBytes = new Uint8Array(txpowLength);
    txpowBytes.set(mineResult.minedHeaderBytes, 0);
    txpowBytes.set(hasBody, mineResult.minedHeaderBytes.length);
    txpowBytes.set(txBodyBytes, mineResult.minedHeaderBytes.length + 1);

    const txpowHex = core.bytesToHex(txpowBytes);
    const txpowId = core.bytesToHex(mineResult.txpowId);

    const response = await fetch(`${baseUrl}${submitPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: txpowHex }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`TxPoW submit failed: HTTP ${response.status} — ${body.slice(0, 200)}`);
    }

    return {
      txpowId,
      miningSource: mineResult.source,
      elapsedMs: mineResult.elapsedMs,
    };
  }

  /**
   * Export wallet as encrypted JSON
   */
  async export(password: string): Promise<string> {
    if (!this.baseSeed) throw new Error('Wallet not initialized');

    const data = {
      version: 3, // Architecture version for migration detection
      baseSeed: core.bytesToHex(this.baseSeed),
      accounts: Array.from(this.accounts.entries()),
      currentIndex: this.currentIndex
    };

    const encrypted = this.encrypt(JSON.stringify(data), password);
    return encrypted;
  }

  /**
   * Import wallet from encrypted JSON
   */
  async import(encryptedData: string, password: string): Promise<void> {
    const decrypted = this.decrypt(encryptedData, password);
    const data = JSON.parse(decrypted);

    // Check version for migration
    if (data.version < 3) {
      console.warn('Importing wallet from older architecture - addresses will be re-derived');
    }

    this.baseSeed = core.hexToBytes(data.baseSeed || data.seed);
    const savedCount = data.currentIndex as number;

    // Clear caches and re-derive addresses from index 0 (same as load())
    this.treeKeyCache.clear();
    this.accounts.clear();
    this.currentIndex = 0;
    for (let i = 0; i < savedCount; i++) {
      const { address, publicKey } = this.deriveAddressFromSeed(this.baseSeed!, i);
      this.accounts.set(address, { address, publicKey, index: i });
    }
    this.currentIndex = savedCount;

    await this.save();
  }

  // ============================================================================
  // PRIVATE: Per-Address TreeKey Architecture Methods
  // ============================================================================

  /**
   * Derive address from base seed using the unified hierarchical TreeKey scheme.
   *
   * Unified derivation:
   * 1. root_priv_seed = deriveRootPrivSeed(baseSeed)
   * 2. child_seed_i   = deriveUnifiedChildSeed(baseSeed, i)
   * 3. treeKey        = new TreeKey(child_seed_i, 64, 3)
   * 4. address pubkey = treeKey.getPublicKey() (MMR root)
   * 5. script         = RETURN SIGNEDBY(pubkey)
   * 6. address        = scriptToAddress(script)
   */
  private deriveAddressFromSeed(baseSeed: Uint8Array, addressIndex: number): { address: string; publicKey: string } {
    const addressPubkey = core.deriveUnifiedAddressPublicKey(baseSeed, addressIndex);
    const publicKeyHex = '0x' + core.bytesToHex(addressPubkey);
    const script = core.scriptFromWotsPk(addressPubkey);
    const address = core.scriptToAddress(script);
    return { address, publicKey: publicKeyHex };
  }

  /**
   * Get or create the unified child TreeKey for `addressIndex`.
   *
   * TreeKeys are cached to avoid expensive WOTS key-tree regeneration.
   * Each child TreeKey is size=64, depth=3 (4 096 one-time signatures).
   */
  private async getOrCreateTreeKey(addressIndex: number): Promise<core.TreeKey> {
    let treeKey = this.treeKeyCache.get(addressIndex);
    if (treeKey) return treeKey;

    if (!this.baseSeed) throw new Error('Wallet not initialized');

    treeKey = core.createUnifiedChildTreeKey(this.baseSeed, addressIndex);
    this.treeKeyCache.set(addressIndex, treeKey);
    return treeKey;
  }

  // ============================================================================
  // PRIVATE: Helper Methods
  // ============================================================================

  private async generateAccounts(count: number): Promise<void> {
    const targetCount = Math.min(count, MinimaWallet.MAX_ADDRESSES);
    for (let i = this.accounts.size; i < targetCount; i++) {
      await this.createAccount();
    }
  }

  private serializeTransaction(tx: Transaction): Uint8Array {
    return core.utf8ToBytes(JSON.stringify(tx));
  }

  private encrypt(data: string, password: string): string {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return Buffer.concat([salt, iv, authTag, encrypted]).toString('base64');
  }

  private decrypt(encryptedData: string, password: string): string {
    const data = Buffer.from(encryptedData, 'base64');
    
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 32);
    const authTag = data.slice(32, 48);
    const encrypted = data.slice(48);
    
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  private async save(): Promise<void> {
    if (!this.baseSeed || !this.password) return;

    const data = {
      version: 3,
      baseSeed: core.bytesToHex(this.baseSeed),
      accounts: Array.from(this.accounts.entries()),
      currentIndex: this.currentIndex
    };

    const encrypted = this.encrypt(JSON.stringify(data), this.password);
    await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
    await fs.writeFile(this.storagePath, encrypted, 'utf8');
  }

  private async load(): Promise<void> {
    if (!this.password) throw new Error('Password required to load wallet');

    try {
      const encrypted = await fs.readFile(this.storagePath, 'utf8');
      const decrypted = this.decrypt(encrypted, this.password);
      const data = JSON.parse(decrypted);

      // Check version for migration
      if (data.version < 3) {
        console.warn('Loading wallet from older architecture - addresses will be re-derived');
      }

      this.baseSeed = core.hexToBytes(data.baseSeed || data.seed);
      this.currentIndex = data.currentIndex;
      
      // Clear caches for fresh state
      this.treeKeyCache.clear();
      this.accounts.clear();
      
      // Re-derive addresses with correct architecture
      for (let i = 0; i < this.currentIndex; i++) {
        const { address, publicKey } = this.deriveAddressFromSeed(this.baseSeed!, i);
        this.accounts.set(address, {
          address,
          publicKey,
          index: i
        });
      }
    } catch (error) {
      throw new Error('Failed to load wallet: ' + error);
    }
  }

  /**
   * Clear TreeKey cache (useful for memory management)
   */
  clearTreeKeyCache(): void {
    this.treeKeyCache.clear();
  }

  /**
   * Get wallet statistics
   */
  getStats(): { accountCount: number; cachedTreeKeys: number; maxAddresses: number } {
    return {
      accountCount: this.accounts.size,
      cachedTreeKeys: this.treeKeyCache.size,
      maxAddresses: MinimaWallet.MAX_ADDRESSES
    };
  }
}
