/**
 * Totem Core Wallet Implementation
 * Following UX Design Document specifications
 *
 * Unified Hierarchical Key Derivation (2026-06):
 * All addresses use a single unified scheme — no mode branching.
 *   root_priv_seed = SHA3-256(serializeMiniData(baseSeed) ‖ serializeMiniData("ROOT_IDENTITY"))
 *   child_seed_i   = SHA3-256(serializeMiniData(root_priv_seed) ‖ serializeMiniData(indexBytes(i)))
 *
 * Each address[i] has its own TreeKey: createUnifiedChildTreeKey(baseSeed, i)
 * Address public key = TreeKey root. Signing produces 3 proofs (Root→L1→L2→DATA).
 *
 * Signature capacity: 64 addresses × 4,096 signatures each = 262,144 one-time signatures.
 * On-demand model: only address[0] is created on setup; additional addresses added via addNextAddress().
 */

import { sha3_256 } from '@noble/hashes/sha3';
import { mnemonicToSeed, generateMnemonic, validateMnemonic, cleanMnemonic } from '../wallet/mnemonic';
import { makeProjectApiCall } from './api/base';
import { AxiaRpcClient } from './api/AxiaRpcClient';
import { RootIdentityWallet } from '../../../totem-sdk/packages/root-identity/src/RootIdentityWallet';
import type { OwnershipProof } from '../../../totem-sdk/packages/root-identity/src/types';
import { scriptFromWotsPk } from '../../../totem-sdk/packages/core/src/script';
import { scriptToAddress } from '../../../totem-sdk/packages/core/src/derive';
import {
  TreeKey,
  TreeKeyNode,
  KeyGenProgress,
  ProgressCallback,
  createUnifiedChildTreeKey,
  createUnifiedChildTreeKeyAsync,
  deriveUnifiedAddressPublicKey,
} from '../../../totem-sdk/packages/core/src/treekey';
import { parentChildSigCache } from './stores/ParentChildSigCache';
import { mxToHex } from './utils/minima-base32';
import { WalletInitEvent, WalletInitEventCallback, createInitEvent } from './wallet/events';
import { WalletLogger } from './transaction/TxLogger';

export type { KeyGenProgress, ProgressCallback };
export type { WalletInitEvent, WalletInitEventCallback };

export interface WalletState {
  // Core Wallet
  accounts: Account[];
  activeAccount: string;
  network: Network;
  
  // Account View Mode
  viewMode: 'global' | 'filtered';
  filteredAddressIndex: number | null;
  
  // Balances & Tokens
  balances: Map<string, Balance>;
  tokens: Token[];
  prices: PriceData;
  
  // Transactions
  pendingTx: Transaction[];
  txHistory: Transaction[];
  
  // Security
  locked: boolean;
  sessionExpired: boolean;  // True if session was active but service worker restarted (needs re-unlock)
  lastActivity: number;
  connectedDapps: DappConnection[];
  
  // WOTS Specific (w=8 parameter, 34-chain signatures: 32 msg + 2 checksum)
  wots: {
    signatureCount: number;
    keyHealth: number;
    lastRotation: number;
    remainingSignatures: number;
  };
}

export interface Account {
  address: string;
  name: string;
  index: number;
  publicKey: string;
  balance: string;
}

export interface Network {
  name: string;
  chainId: string;
  rpcUrl: string;
  explorerUrl: string;
}

export interface Balance {
  amount: string;
  symbol: string;
  usdValue?: number;
}

export interface Token {
  tokenid: string;
  token: string;
  name?: string;
  symbol?: string;
  balance?: string;
  address?: string;
  ticker?: string;
  decimals?: string;
  total: string;
  sendable: string;
  confirmed: string;
  unconfirmed?: string;
  coins?: string;
  url?: string;
  description?: string;
  owner?: string;
  script?: string;
  icon?: string;
}

export interface PriceData {
  [symbol: string]: number;
}

export interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: string;
  fee: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  tokenId?: string;
  burn?: string;
}

export interface DappConnection {
  origin: string;
  name: string;
  icon?: string;
  permissions: string[];
  connectedAt: number;
  lastUsed: number;
}

/**
 * Core Wallet Manager
 */
export class WalletManager {
  private state: WalletState;
  private encryptedSeed: string | null = null;
  private sessionKey: CryptoKey | null = null;
  private sessionSeed: Uint8Array | null = null;
  private sessionRootPublicKey: string | null = null;
  private sessionTreeKey: TreeKey | null = null; // Cached TreeKey for signing (legacy)
  private sessionAddressTreeKeys: Map<number, TreeKey> = new Map(); // Per-address TreeKeys (new architecture)
  private rpcClient: AxiaRpcClient | null = null;
  
  // Cache for balance aggregation (30s TTL)
  private balanceCache: {
    value: string | null;
    timestamp: number;
  } = { value: null, timestamp: 0 };
  private readonly BALANCE_CACHE_TTL = 30000; // 30 seconds
  
  // Session state tracking for MV3 service worker lifecycle
  // When true, indicates session was active but service worker restarted (requires re-unlock)
  private sessionExpired: boolean = false;

  constructor() {
    this.state = this.getInitialState();
    // Lazy instantiation of RPC client to avoid chrome.storage issues in UI contexts
  }

  /**
   * Get or create RPC client (lazy singleton)
   * Ensures chrome.storage is available before instantiation
   */
  private getRpcClient(): AxiaRpcClient {
    if (!this.rpcClient) {
      this.rpcClient = new AxiaRpcClient();
    }
    return this.rpcClient;
  }

  private sessionIdentityHash: string | null = null;

  private setRootPublicKeyAndIdentity(rootPubkeyHex: string): void {
    this.sessionRootPublicKey = rootPubkeyHex;
    const hashBytes = sha3_256(new TextEncoder().encode(rootPubkeyHex));
    const identityHash = Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    this.sessionIdentityHash = identityHash;
    this.getRpcClient().setUserIdentityHash(identityHash);
  }

  getUserIdentityHash(): string | null {
    return this.sessionIdentityHash;
  }

  /**
   * Fetch the server-side WOTS watermark for the currently active root public key.
   * Returns null if no session is active or the fetch fails.
   */
  async fetchServerWatermark(): Promise<{ l1: number; l2: number; l3: number } | null> {
    const rootPublicKey = this.sessionRootPublicKey;
    if (!rootPublicKey) return null;
    try {
      return await this.getRpcClient().getWatermark(rootPublicKey);
    } catch (err: any) {
      WalletLogger.warn('[WalletManager] fetchServerWatermark failed:', err.message);
      return null;
    }
  }

  /**
   * Store session active flag in chrome.storage.session (MV3 session-scoped storage)
   * This flag persists across service worker restarts within the same browser session
   */
  private async setSessionActive(active: boolean): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.session) {
        if (active) {
          await chrome.storage.session.set({ sessionActive: true, sessionStarted: Date.now() });
          WalletLogger.info(' Session marked active in session storage');
        } else {
          await chrome.storage.session.remove(['sessionActive', 'sessionStarted']);
          WalletLogger.info(' Session cleared from session storage');
        }
      }
    } catch (error) {
      WalletLogger.warn(' Failed to update session storage:', error);
    }
  }

  /**
   * Check if a session was previously active (service worker restarted mid-session)
   */
  private async wasSessionActive(): Promise<boolean> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.session) {
        const result = await chrome.storage.session.get(['sessionActive']);
        return result.sessionActive === true;
      }
    } catch (error) {
      WalletLogger.warn(' Failed to check session storage:', error);
    }
    return false;
  }

  /**
   * Restore session state after service worker restart
   * Called during background startup to detect expired sessions
   * 
   * Returns:
   * - 'active': Session still active (wallet unlocked in memory)
   * - 'expired': Session was active but service worker restarted (needs re-unlock)
   * - 'locked': No active session (wallet is locked normally)
   */
  async restoreSession(): Promise<'active' | 'expired' | 'locked'> {
    WalletLogger.info(' Restoring session state...');
    
    // If we have in-memory session, we're still active
    if (this.sessionSeed && !this.state.locked) {
      WalletLogger.info(' Session already active in memory');
      return 'active';
    }
    
    const sessionData = await chrome.storage.session.get(['lastActivity']);
    const lastActivity = sessionData?.lastActivity || 0;
    const storageResult = await chrome.storage.local.get(['auto_lock_enabled', 'auto_lock_minutes']);
    const autoLockEnabled = storageResult.auto_lock_enabled !== false;
    const rawMinutes = Number(storageResult.auto_lock_minutes);
    const autoLockMinutes = (rawMinutes > 0 && rawMinutes <= 60) ? rawMinutes : 30;
    const LOCK_TIMEOUT_MS = autoLockMinutes * 60 * 1000;
    if (autoLockEnabled && lastActivity > 0 && (Date.now() - lastActivity) > LOCK_TIMEOUT_MS) {
      WalletLogger.info(' Auto-lock due to inactivity timeout');
      this.sessionExpired = true;
      this.state.sessionExpired = true;
      this.state.locked = true;
      return 'expired';
    }
    
    // Check if there was an active session in session storage
    const wasActive = await this.wasSessionActive();
    
    if (wasActive) {
      // Session was active but we lost in-memory state (service worker restart)
      WalletLogger.info(' Session expired - was active but service worker restarted');
      this.sessionExpired = true;
      this.state.sessionExpired = true;
      this.state.locked = true;
      
      // Broadcast to UI so it can show unlock prompt immediately
      chrome.runtime.sendMessage({
        method: 'wallet:sessionExpired'
      }).catch(() => {});
      
      return 'expired';
    }
    
    // No previous session - wallet is normally locked
    WalletLogger.info(' No active session - wallet is locked');
    this.state.sessionExpired = false;
    return 'locked';
  }

  /**
   * Check if session expired (service worker restarted while unlocked)
   */
  isSessionExpired(): boolean {
    return this.sessionExpired;
  }

  private getInitialState(): WalletState {
    return {
      accounts: [],
      activeAccount: '',
      network: {
        name: 'Minima Mainnet',
        chainId: '0x1',
        rpcUrl: 'https://api.axia.to',
        explorerUrl: 'https://explorer.axia.to'
      },
      viewMode: 'global',
      filteredAddressIndex: null,
      balances: new Map(),
      tokens: [],
      prices: {},
      pendingTx: [],
      txHistory: [],
      locked: true,
      sessionExpired: false,
      lastActivity: Date.now(),
      connectedDapps: [],
      wots: {
        signatureCount: 0,
        keyHealth: 100,
        lastRotation: Date.now(),
        remainingSignatures: 262144 // 64^3 signatures per root
      }
    };
  }

  /**
   * Generate a 24-word BIP39 mnemonic WITHOUT storing it
   * Used by UI to display recovery phrase before wallet creation
   */
  generateNewMnemonic(): string {
    return generateMnemonic();
  }

  /**
   * Create a new wallet with mnemonic
   * @param password - Password to encrypt the wallet
   * @param onProgress - Optional callback for key generation progress
   */
  async createWallet(password: string, onProgress?: ProgressCallback): Promise<{ mnemonic: string; address: string }> {
    const mnemonic = generateMnemonic();
    
    // Minima-compatible derivation: SHA3-256(cleanSeedPhrase(mnemonic))
    // No PBKDF2, no HKDF - direct hash produces 32-byte baseSeed
    const baseSeed = mnemonicToSeed(mnemonic);

    // Encrypt and store seed AND mnemonic
    await this.encryptAndStoreSeed(baseSeed, password);
    await this.encryptAndStoreMnemonic(mnemonic, password);
    
    // Generate all 64 addresses with progress reporting
    await this.generateAllAddresses(baseSeed, onProgress);
    
    this.state.locked = false;
    
    // Store session seed (TreeKey and root public key are set in generateAllAddresses)
    this.sessionSeed = baseSeed;
    
    return { mnemonic, address: this.state.accounts[0].address };
  }

  /**
   * Import wallet from mnemonic
   * @param mnemonic - BIP39 mnemonic phrase
   * @param password - Password to encrypt the wallet
   * @param onProgress - Optional callback for key generation progress
   */
  async importWallet(mnemonic: string, password: string, onProgress?: ProgressCallback): Promise<{ address: string }> {
    WalletLogger.info(' Starting wallet import...');
    
    if (!validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }
    
    // Minima-compatible derivation: SHA3-256(cleanSeedPhrase(mnemonic))
    // No PBKDF2, no HKDF - direct hash produces 32-byte baseSeed
    const baseSeed = mnemonicToSeed(mnemonic);

    // Encrypt and store seed AND mnemonic
    WalletLogger.info(' Encrypting and storing seed...');
    await this.encryptAndStoreSeed(baseSeed, password);
    await this.encryptAndStoreMnemonic(mnemonic, password);
    
    // Generate all 64 addresses with progress reporting
    WalletLogger.info(' Generating addresses...');
    await this.generateAllAddresses(baseSeed, onProgress);
    
    // Validate: ensure at least 1 account
    WalletLogger.info(' Validating generated accounts...');
    if (this.state.accounts.length < 1) {
      const error = new Error(
        `Address generation failed: expected at least 1 account, got ${this.state.accounts.length}`
      );
      WalletLogger.error(error.message);
      throw error;
    }
    WalletLogger.info(`Wallet ready: ${this.state.accounts.length} account(s)`);
    
    // Validate each account has non-empty address and publicKey
    for (let i = 0; i < this.state.accounts.length; i++) {
      const account = this.state.accounts[i];
      if (!account.address || account.address.length === 0) {
        const error = new Error(
          `Address generation failed: account ${i} has empty address`
        );
        WalletLogger.error(error.message);
        throw error;
      }
      if (!account.publicKey || account.publicKey.length === 0) {
        const error = new Error(
          `Address generation failed: account ${i} has empty publicKey`
        );
        WalletLogger.error(error.message);
        throw error;
      }
    }
    
    WalletLogger.info(`${this.state.accounts.length} accounts validated`);
    
    this.state.locked = false;
    
    // Store session seed (TreeKey and root public key are set in generateAllAddresses)
    this.sessionSeed = baseSeed;
    
    WalletLogger.info('Wallet import completed');
    WalletLogger.debug(`First address: ${this.state.accounts[0].address.substring(0, 20)}...`);
    
    return { address: this.state.accounts[0].address };
  }

  /**
   * Import wallet with real-time event streaming
   * Emits granular WalletInitEvents for each step of the import process
   * 
   * @param mnemonic - BIP39 mnemonic phrase
   * @param password - Password to encrypt the wallet
   * @param onEvent - Callback for real-time wallet initialization events
   */
  async importWalletWithEvents(
    mnemonic: string, 
    password: string, 
    onEvent: WalletInitEventCallback
  ): Promise<{ address: string }> {
    try {
      // Step 1: Validate mnemonic
      onEvent(createInitEvent('mnemonic_validate', 'Validating 24-word recovery phrase...'));
      
      if (!validateMnemonic(mnemonic)) {
        onEvent(createInitEvent('error', 'Invalid mnemonic phrase', { error: 'Invalid mnemonic phrase' }));
        throw new Error('Invalid mnemonic phrase');
      }
      onEvent(createInitEvent('mnemonic_validate', 'Recovery phrase validated (BIP39 checksum OK)'));

      // Step 2: Derive seed
      onEvent(createInitEvent('seed_derive', 'Deriving master seed with SHA3-256...'));
      const baseSeed = mnemonicToSeed(mnemonic);
      onEvent(createInitEvent('seed_derive', 'Master seed derived (32 bytes, Minima-compatible)'));

      // Step 3: Encrypt and store vault
      onEvent(createInitEvent('vault_encrypt', 'Deriving encryption key with PBKDF2 (100k iterations)...'));
      await this.encryptAndStoreSeed(baseSeed, password);
      onEvent(createInitEvent('vault_encrypt', 'Seed encrypted with AES-256-GCM'));
      
      await this.encryptAndStoreMnemonic(mnemonic, password);
      onEvent(createInitEvent('vault_encrypt', 'Mnemonic encrypted and stored securely'));

      // Step 4: Generate first address (on-demand model, unified derivation)
      onEvent(createInitEvent('treekey_start', 'Starting unified key generation...'));
      onEvent(createInitEvent('treekey_start', 'Unified hierarchical derivation — all addresses use the same scheme'));
      onEvent(createInitEvent('treekey_start', 'Each address provides 4,096 one-time signatures; total capacity: 262,144'));

      const progressCallback: ProgressCallback = (progress) => {
        if (progress.phase === 'wots_keys') {
          onEvent(createInitEvent('wots_key',
            `WOTS key ${progress.current}/${progress.total}: Generating 34 SHA3-256 hash chains (w=8)`,
            { current: progress.current, total: progress.total }
          ));
        } else if (progress.phase === 'mmr_build') {
          onEvent(createInitEvent('mmr_build',
            progress.current === 0
              ? 'Building Merkle Mountain Range from 64 WOTS public keys...'
              : 'MMR tree complete - root hash computed',
            { current: progress.current, total: progress.total }
          ));
        } else if (progress.phase === 'address_derive') {
          onEvent(createInitEvent('address_derive',
            `Address ${progress.current}/${progress.total}: TreeKey root → Mx address`,
            { current: progress.current, total: progress.total, addressIndex: progress.current - 1 }
          ));
        } else if (progress.phase === 'complete') {
          onEvent(createInitEvent('complete', 'Key generation complete'));
        }
      };

      await this.generateAllAddresses(baseSeed, progressCallback);

      // Step 5: Validate accounts
      onEvent(createInitEvent('storage_persist', `Validating ${this.state.accounts.length} generated accounts...`));
      
      if (this.state.accounts.length < 1) {
        const errorMsg = `Expected at least 1 account, got ${this.state.accounts.length}`;
        onEvent(createInitEvent('error', errorMsg, { error: errorMsg }));
        throw new Error(`Address generation failed: ${errorMsg}`);
      }

      for (let i = 0; i < this.state.accounts.length; i++) {
        const account = this.state.accounts[i];
        if (!account.address || !account.publicKey) {
          const errorMsg = `Account ${i} has invalid data`;
          onEvent(createInitEvent('error', errorMsg, { error: errorMsg }));
          throw new Error(`Address generation failed: ${errorMsg}`);
        }
      }

      onEvent(createInitEvent('storage_persist', `${this.state.accounts.length} initial accounts validated (remaining in background)`));
      onEvent(createInitEvent('storage_persist', 'Wallet persisted to encrypted storage'));

      this.state.locked = false;
      this.sessionSeed = baseSeed;

      // Final completion
      onEvent(createInitEvent('complete', `Wallet ready - Primary address: ${this.state.accounts[0].address.slice(0, 20)}...`));

      return { address: this.state.accounts[0].address };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      onEvent(createInitEvent('error', errorMsg, { error: errorMsg }));
      throw error;
    }
  }

  /**
   * Lock wallet
   */
  lock(): void {
    // Cancel any ongoing background address generation
    this.cancelBackgroundGeneration();
    
    try {
      import('./sync/periodic').then(({ periodicWatermarkSync }) => {
        periodicWatermarkSync.stop();
      });
    } catch (error) {
      WalletLogger.warn(' Failed to stop periodic sync:', error);
    }
    
    // Save parent-child signature cache before clearing TreeKey
    // This preserves cached L1→L2 signatures for future sessions
    if (this.sessionTreeKey && this.sessionRootPublicKey) {
      const cache = this.sessionTreeKey.getCachedSignatures();
      if (cache.size > 0) {
        parentChildSigCache.saveCacheForWallet(this.sessionRootPublicKey, cache)
          .catch(err => WalletLogger.warn(' Failed to save signature cache:', err));
      }
    }
    
    this.sessionKey = null;
    if (this.sessionSeed) {
      this.sessionSeed.fill(0);
    }
    this.sessionSeed = null;
    this.sessionRootPublicKey = null;
    this.sessionIdentityHash = null;
    if (this.rpcClient) {
      this.rpcClient.clearUserIdentityHash();
    }
    this.sessionTreeKey = null;
    this.clearPerAddressTreeKeyCache();
    this.state.locked = true;
    this.sessionExpired = false;
    this.state.sessionExpired = false;
    
    chrome.storage.session.set({ lastActivity: 0 }).catch(() => {});
    
    // Clear session flag from session storage
    this.setSessionActive(false).catch(() => {});
  }

  /**
   * Check if encrypted seed exists in storage and is valid
   * Used for proper initialization detection
   */
  async hasEncryptedSeed(): Promise<boolean> {
    try {
      const stored = await chrome.storage.local.get('encryptedSeed');
      if (!stored.encryptedSeed) return false;
      
      const { iv, ct } = stored.encryptedSeed;
      
      // Verify both exist, are strings, and are non-empty
      if (!iv || !ct || typeof iv !== 'string' || typeof ct !== 'string') {
        return false;
      }
      
      // Validate they are valid hex strings with reasonable length
      // IV should be 24 chars (12 bytes * 2), CT should be longer
      if (iv.length < 24 || ct.length < 32) {
        WalletLogger.warn(' Encrypted seed has invalid length');
        return false;
      }
      
      // Validate hex format (only hex chars)
      const hexRegex = /^[0-9a-fA-F]+$/;
      if (!hexRegex.test(iv) || !hexRegex.test(ct)) {
        WalletLogger.warn(' Encrypted seed has invalid hex format');
        return false;
      }
      
      return true;
    } catch (error) {
      WalletLogger.error(' Error checking encrypted seed:', error);
      return false;
    }
  }

  /**
   * Unlock wallet with password
   */
  async unlock(password: string): Promise<boolean> {
    try {
      const stored = await chrome.storage.local.get(['encryptedSeed', 'seedFingerprint', 'accounts']);
      if (!stored.encryptedSeed) return false;
      
      const { iv, ct } = stored.encryptedSeed;
      const seed = await this.decryptSeed(iv, ct, password);
      
      if (seed) {
        // DIAGNOSTIC: Verify seed fingerprint matches stored fingerprint
        if (stored.seedFingerprint) {
          const currentFingerprint = this.computeSeedFingerprint(seed);
          if (currentFingerprint !== stored.seedFingerprint) {
            WalletLogger.error(`CRITICAL SEED MISMATCH: Current fingerprint ${currentFingerprint} !== stored ${stored.seedFingerprint}`);
            throw new Error('SEED_MISMATCH: Decrypted seed does not match stored wallet. Storage may be corrupted.');
          }
          WalletLogger.debug(`Seed fingerprint verified: ${currentFingerprint}`);
        } else {
          WalletLogger.warn('No seed fingerprint stored - legacy wallet, will store on next operation');
        }
        
        // Check for existing addresses before regenerating
        await this.unlockWithSmartRestore(seed);
        
        // DIAGNOSTIC: Multi-index invariant check (recommendation #4)
        // Verify indices 0, 1, 24, 63 to catch derivation mismatches at wallet load
        if (stored.accounts && stored.accounts.length > 0) {
          // Build set of stored account indices for reliable presence check (handles sparse arrays)
          const storedIndices = new Set(stored.accounts.map((acc: any) => acc.index));
          const candidateIndices = [0, 1, 24, 63];
          const indicesToCheck = candidateIndices.filter(i => storedIndices.has(i));
          
          WalletLogger.info(`INVARIANT CHECK: Verifying ${indicesToCheck.length} of ${candidateIndices.length} indices: [${indicesToCheck.join(', ')}]`);
          if (indicesToCheck.length < candidateIndices.length) {
            const skipped = candidateIndices.filter(i => !storedIndices.has(i));
            WalletLogger.debug(`INVARIANT CHECK: Skipped indices not in storage: [${skipped.join(', ')}]`);
          }
          
          for (const idx of indicesToCheck) {
            const storedAccount = stored.accounts.find((acc: any) => acc.index === idx);
            if (!storedAccount) continue; // Safety check (should never happen due to filter)
            
            const derived = this.deriveAddressFromSeed(seed, idx);
            
            WalletLogger.debug(`INVARIANT[${idx}]: Derived addr: ${derived.address.slice(0, 24)}...`);
            WalletLogger.debug(`INVARIANT[${idx}]: Stored addr:  ${storedAccount.address.slice(0, 24)}...`);
            
            if (derived.address !== storedAccount.address) {
              WalletLogger.error(`CRITICAL ADDRESS MISMATCH at index ${idx}: Derived ${derived.address} !== Stored ${storedAccount.address}`);
              throw new Error(`ADDRESS_MISMATCH: Derived address[${idx}] does not match stored. Wallet data is inconsistent.`);
            }
            
            if (derived.publicKey !== storedAccount.publicKey) {
              WalletLogger.error(`CRITICAL PUBKEY MISMATCH at index ${idx}: Derived ${derived.publicKey} !== Stored ${storedAccount.publicKey}`);
              throw new Error(`PUBKEY_MISMATCH: Derived publicKey[${idx}] does not match stored. This will cause signature failures.`);
            }
          }
          
          WalletLogger.info(`INVARIANT CHECK PASSED: All ${indicesToCheck.length} indices verified successfully`);
        }
        
        this.state.locked = false;
        this.state.lastActivity = Date.now();
        
        await chrome.storage.session.set({ lastActivity: Date.now() });
        
        // Store session seed (TreeKey and root public key are set in generateAllAddresses)
        this.sessionSeed = seed;
        
        // Clear expired flag and mark session as active in session storage
        this.sessionExpired = false;
        this.state.sessionExpired = false;
        await this.setSessionActive(true);
        
        // Sync watermark with server on unlock (multi-device safety + reinstall restore).
        // Pass fetchServerWatermark as the server-fetch callback so syncWatermark can
        // restore from the Axia API when chrome.storage.local is empty (reinstall case).
        try {
          const { syncWatermark } = await import('./sync/watermark');
          const syncResult = await syncWatermark(
            this.sessionRootPublicKey!,
            () => this.fetchServerWatermark()
          );

          if (syncResult.restoredFromServer) {
            WalletLogger.info(' WOTS watermark restored from server (reinstall recovery).');
          }
          if (syncResult.multiDeviceConflict) {
            WalletLogger.warn(' Multi-device conflict detected! Another device has advanced the watermark.');
          }
        } catch (error: any) {
          WalletLogger.warn(' Watermark sync failed on unlock:', error.message);
        }
        
        try {
          const { periodicWatermarkSync } = await import('./sync/periodic');
          periodicWatermarkSync.start(this.sessionRootPublicKey);
        } catch (error: any) {
          WalletLogger.warn(' Failed to start periodic watermark sync:', error.message);
        }
        
        return true;
      }
      return false;
    } catch (error: any) {
      // Re-throw migration errors to be handled by UI
      if (error.message?.includes('MIGRATION_REQUIRED')) {
        throw error;
      }
      return false;
    }
  }

  /**
   * Get current wallet state (async to support restoration from storage)
   */
  async getStateAsync(): Promise<WalletState> {
    // If accounts are empty but wallet is initialized, restore from storage
    if (this.state.accounts.length === 0) {
      await this.restoreAddressesFromStorage();
    }
    return { ...this.state };
  }

  /**
   * Get current wallet state (synchronous - use getStateAsync for guaranteed fresh data)
   */
  getState(): WalletState {
    return { ...this.state };
  }

  /**
   * Update WOTS signature count and health
   */
  updateWOTSHealth(signaturesUsed: number): void {
    this.state.wots.signatureCount += signaturesUsed;
    this.state.wots.remainingSignatures -= signaturesUsed;
    
    // Calculate health percentage
    const usagePercent = (this.state.wots.signatureCount / 262144) * 100;
    this.state.wots.keyHealth = Math.max(0, 100 - usagePercent);
    
    // Check if rotation is needed (below 15% health)
    if (this.state.wots.keyHealth < 15) {
      this.notifyKeyRotationNeeded();
    }
  }

  /**
   * Add connected dApp
   */
  connectDapp(origin: string, name: string, permissions: string[]): void {
    const connection: DappConnection = {
      origin,
      name,
      permissions,
      connectedAt: Date.now(),
      lastUsed: Date.now()
    };
    
    this.state.connectedDapps.push(connection);
  }

  /**
   * Disconnect dApp
   */
  disconnectDapp(origin: string): void {
    this.state.connectedDapps = this.state.connectedDapps.filter(
      dapp => dapp.origin !== origin
    );
  }

  /**
   * Update address name/tag
   */
  async updateAddressName(index: number, name: string): Promise<void> {
    if (index < 0 || index >= 64) {
      throw new Error('Invalid address index. Must be between 0 and 63.');
    }
    
    const account = this.state.accounts.find(acc => acc.index === index);
    if (account) {
      account.name = name;
      await this.saveAddressMetadata();
    }
  }

  /**
   * Get address name by index
   */
  getAddressName(index: number): string {
    const account = this.state.accounts.find(acc => acc.index === index);
    return account?.name || `Address ${index + 1}`;
  }

  /**
   * Exclude address from global view
   */
  async excludeAddress(index: number): Promise<void> {
    if (index < 0 || index >= 64) {
      throw new Error('Invalid address index. Must be between 0 and 63.');
    }
    
    const stored = await chrome.storage.local.get('excludedAddresses');
    const excludedAddresses: number[] = stored.excludedAddresses || [];
    
    if (!excludedAddresses.includes(index)) {
      excludedAddresses.push(index);
      await chrome.storage.local.set({ excludedAddresses });
    }
  }

  /**
   * Include address in global view
   */
  async includeAddress(index: number): Promise<void> {
    if (index < 0 || index >= 64) {
      throw new Error('Invalid address index. Must be between 0 and 63.');
    }
    
    const stored = await chrome.storage.local.get('excludedAddresses');
    const excludedAddresses: number[] = stored.excludedAddresses || [];
    
    const filteredExcluded = excludedAddresses.filter(i => i !== index);
    await chrome.storage.local.set({ excludedAddresses: filteredExcluded });
  }

  /**
   * Check if address is excluded
   */
  async isAddressExcluded(index: number): Promise<boolean> {
    const stored = await chrome.storage.local.get('excludedAddresses');
    const excludedAddresses: number[] = stored.excludedAddresses || [];
    return excludedAddresses.includes(index);
  }

  /**
   * Get all address strings for coin selection (synchronous)
   */
  getAllAddresses(): string[] {
    return this.state.accounts.map(account => account.address);
  }
  
  /**
   * Get all accounts (for connected sites and verification)
   */
  getAllAccounts(): Account[] {
    return [...this.state.accounts];
  }
  
  /**
   * Get account by index
   */
  getAccountByIndex(index: number): Account | undefined {
    return this.state.accounts.find(acc => acc.index === index);
  }
  
  /**
   * Get all non-excluded addresses
   */
  async getNonExcludedAddresses(): Promise<Account[]> {
    const stored = await chrome.storage.local.get('excludedAddresses');
    const excludedAddresses: number[] = stored.excludedAddresses || [];
    
    return this.state.accounts.filter(
      account => !excludedAddresses.includes(account.index)
    );
  }

  /**
   * Get all excluded addresses
   */
  async getExcludedAddresses(): Promise<Account[]> {
    const stored = await chrome.storage.local.get('excludedAddresses');
    const excludedAddresses: number[] = stored.excludedAddresses || [];
    
    return this.state.accounts.filter(
      account => excludedAddresses.includes(account.index)
    );
  }

  /**
   * Set view mode to global (all non-excluded addresses)
   */
  setGlobalView(): void {
    this.state.viewMode = 'global';
    this.state.filteredAddressIndex = null;
  }

  /**
   * Set view mode to filtered (specific address)
   */
  setFilteredView(addressIndex: number): void {
    if (addressIndex < 0 || addressIndex >= 64) {
      throw new Error('Invalid address index. Must be between 0 and 63.');
    }
    
    this.state.viewMode = 'filtered';
    this.state.filteredAddressIndex = addressIndex;
  }

  /**
   * Get current view mode
   */
  getViewMode(): { mode: 'global' | 'filtered'; addressIndex: number | null } {
    return {
      mode: this.state.viewMode,
      addressIndex: this.state.filteredAddressIndex
    };
  }

  /**
   * Get addresses for current view mode
   */
  async getActiveViewAddresses(): Promise<Account[]> {
    if (this.state.viewMode === 'global') {
      return await this.getNonExcludedAddresses();
    } else if (this.state.filteredAddressIndex !== null) {
      const account = this.state.accounts.find(
        acc => acc.index === this.state.filteredAddressIndex
      );
      return account ? [account] : [];
    }
    return [];
  }

  /**
   * Get random receive address from non-excluded addresses
   */
  async getRandomReceiveAddress(): Promise<Account | null> {
    const availableAddresses = await this.getNonExcludedAddresses();
    
    if (availableAddresses.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * availableAddresses.length);
    return availableAddresses[randomIndex];
  }

  /**
   * Get random unused receive address (prefers addresses with zero balance)
   */
  async getRandomUnusedReceiveAddress(): Promise<Account | null> {
    const availableAddresses = await this.getNonExcludedAddresses();
    
    if (availableAddresses.length === 0) {
      return null;
    }
    
    const unusedAddresses = availableAddresses.filter(
      account => account.balance === '0'
    );
    
    if (unusedAddresses.length > 0) {
      const randomIndex = Math.floor(Math.random() * unusedAddresses.length);
      return unusedAddresses[randomIndex];
    }
    
    const randomIndex = Math.floor(Math.random() * availableAddresses.length);
    return availableAddresses[randomIndex];
  }

  /**
   * Fetch balances from RPC for specific address
   */
  async fetchAddressBalance(address: string): Promise<Token[]> {
    try {
      const response = await makeProjectApiCall('balance', {
        body: JSON.stringify({ address })
      });
      
      const result = await response.json();
      
      if (result.error) {
        console.error('Balance RPC error:', result.error);
        return [];
      }
      
      const balanceData = result.result?.response || result.response || result.result || result;
      
      if (!balanceData.balance || !Array.isArray(balanceData.balance)) {
        console.warn('Invalid balance response format', balanceData);
        return [];
      }
      
      return balanceData.balance as Token[];
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      return [];
    }
  }

  /**
   * Get detailed MINIMA balance with confirmed/unconfirmed/sendable breakdown
   * 
   * PRODUCTION SAFETY: In production builds, balance fetching should use SmartRouter balance stream
   * This method is only available in Designer Mode for development/testing
   * 
   * @returns Balance breakdown object for active address
   * @throws {Error} In production mode (use SmartRouter balance stream instead)
   * @throws {AxiaError|QuotaExceededError|NetworkError} On RPC failures in Designer mode
   */
  async getBalanceDetailed(): Promise<{ confirmed: string; unconfirmed: string; sendable: string }> {
    // PRODUCTION SAFETY: Block direct RPC balance calls in production
    // Balance fetching should use SmartRouter balance stream exclusively
    if (!__DESIGNER_MODE__) {
      WalletLogger.warn(' ⚠️ PRODUCTION: getBalanceDetailed() called - this should use SmartRouter balance stream instead');
      WalletLogger.warn(' Returning empty balance - UI should subscribe to SmartRouter balance stream');
      return { confirmed: '0', unconfirmed: '0', sendable: '0' };
    }
    
    // Designer Mode: Allow direct RPC calls for development/testing
    WalletLogger.info(' [DESIGNER_MODE] Fetching balance via RPC for development...');
    
    // CRITICAL FIX: Restore addresses from storage if state is empty
    if (this.state.accounts.length === 0) {
      WalletLogger.info(' Accounts empty, restoring from storage...');
      await this.restoreAddressesFromStorage();
    }

    WalletLogger.info(' Fetching balance for active address only (optimized for rate limits)...');
    
    const rpcClient = this.getRpcClient();
    
    // Get active address index (default to 0 if not in filtered mode)
    const activeIndex = this.state.viewMode === 'filtered' && this.state.filteredAddressIndex !== null
      ? this.state.filteredAddressIndex
      : 0;
    
    const activeAccount = this.state.accounts[activeIndex];
    
    if (!activeAccount) {
      WalletLogger.warn(' No active account found');
      return { confirmed: '0', unconfirmed: '0', sendable: '0' };
    }
    
    try {
      // Fetch ONLY the active address balance (1 API call instead of 64)
      const { result } = await rpcClient.call<any>('balance', { address: activeAccount.address });
      
      // Parse balance response
      const balanceData = result?.response || result;
      
      if (balanceData && Array.isArray(balanceData)) {
        // Find MINIMA token (tokenid: '0x00')
        const minimaToken = balanceData.find((t: Token) => t.tokenid === '0x00');
        
        if (minimaToken) {
          WalletLogger.info(` Active address balance: confirmed=${minimaToken.confirmed}, unconfirmed=${minimaToken.unconfirmed}, sendable=${minimaToken.sendable}`);
          
          // Start background lazy-loading of other addresses (non-blocking)
          this.lazyLoadOtherAddresses(activeIndex).catch(err => 
            WalletLogger.warn(' Background address loading failed:', err)
          );
          
          return {
            confirmed: minimaToken.confirmed || '0',
            unconfirmed: minimaToken.unconfirmed || '0',
            sendable: minimaToken.sendable || '0'
          };
        }
      }
      
      WalletLogger.warn(' No MINIMA token found in balance response');
      return { confirmed: '0', unconfirmed: '0', sendable: '0' };
      
    } catch (error) {
      WalletLogger.error(' Failed to fetch active address balance:', error);
      throw error;
    }
  }
  
  /**
   * Background job: Lazy-load balances for other addresses to populate cache
   * Rate-limited to avoid exceeding API quotas (max 5 requests/minute)
   * 
   * PRODUCTION SAFETY: Disabled in production - balance data comes from SmartRouter balance stream
   */
  private async lazyLoadOtherAddresses(skipIndex: number): Promise<void> {
    // PRODUCTION SAFETY: Skip background RPC calls in production
    if (!__DESIGNER_MODE__) {
      WalletLogger.info(' [PRODUCTION] Skipping lazy-load - SmartRouter balance stream handles updates');
      return;
    }
    
    WalletLogger.info(' [DESIGNER_MODE] Starting background lazy-load of other addresses...');
    
    const rpcClient = this.getRpcClient();
    const BATCH_SIZE = 5; // Process 5 addresses at a time
    const BATCH_DELAY = 60000; // Wait 1 minute between batches to stay under rate limits
    
    for (let batchStart = 0; batchStart < this.state.accounts.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, this.state.accounts.length);
      
      // Skip the active address (already fetched)
      const addressesToFetch = this.state.accounts
        .slice(batchStart, batchEnd)
        .filter((_, localIndex) => (batchStart + localIndex) !== skipIndex);
      
      if (addressesToFetch.length === 0) continue;
      
      WalletLogger.info(` Lazy-loading batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: ${addressesToFetch.length} addresses`);
      
      // Fetch this batch in parallel (but limit to BATCH_SIZE concurrent requests)
      await Promise.allSettled(
        addressesToFetch.map(async (account) => {
          try {
            await rpcClient.call<any>('balance', { address: account.address });
          } catch (error) {
            WalletLogger.warn(` Background fetch failed for ${account.address}:`, error);
          }
        })
      );
      
      // Wait before next batch to respect rate limits (unless this is the last batch)
      if (batchEnd < this.state.accounts.length) {
        WalletLogger.info(` Waiting ${BATCH_DELAY / 1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }
    
    WalletLogger.info(' Background lazy-load complete');
  }

  /**
   * Get aggregated MINIMA balance across all 64 addresses with 44-decimal precision
   * Uses 30s cache to avoid excessive RPC calls
   * 
   * @returns Total MINIMA balance as decimal string with full precision
   * @throws {AxiaError|QuotaExceededError|NetworkError} On RPC failures
   */
  async getBalanceAggregated(): Promise<string> {
    WalletLogger.info(' getBalanceAggregated - using optimized single-address fetch');
    
    // Use optimized method that only fetches active address
    const { confirmed } = await this.getBalanceDetailed();
    return confirmed;
  }

  /**
   * Get token holdings aggregated across all addresses
   * Filters out MINIMA (0x00) and returns only custom tokens
   * 
   * NOTE: Token fetching still uses RPC as SmartRouter token streaming is not yet implemented
   * TODO: Migrate to SmartRouter token stream when available
   * 
   * @returns Array of tokens with full metadata and balances
   * @throws {AxiaError|QuotaExceededError|NetworkError} On RPC failures
   */
  async getTokenHoldings(): Promise<Token[]> {
    // PRODUCTION GATE: Block RPC token fetching in production builds
    // SmartRouter token streaming is not yet implemented, so return empty array
    // TODO: Implement SmartRouter token stream and remove this gate
    if (!__DESIGNER_MODE__) {
      WalletLogger.warn(' ⚠️ PRODUCTION: getTokenHoldings() blocked - SmartRouter token stream not yet available');
      WalletLogger.warn(' Returning empty token array - tokens will be available when SmartRouter supports them');
      return [];
    }
    
    WalletLogger.info(' [DESIGNER_MODE] Fetching tokens via RPC for development...');
    
    // CRITICAL FIX: Restore addresses from storage if state is empty
    if (this.state.accounts.length === 0) {
      WalletLogger.info(' Accounts empty, restoring from storage...');
      await this.restoreAddressesFromStorage();
    }

    WalletLogger.info(' Fetching token holdings for all 64 addresses...');
    
    const rpcClient = this.getRpcClient();
    const tokensMap = new Map<string, Token>();
    let successCount = 0;
    let failCount = 0;
    
    // Query all 64 addresses - continue on per-address errors
    for (let i = 0; i < this.state.accounts.length; i++) {
      const account = this.state.accounts[i];
      
      try {
        const { result } = await rpcClient.call<any>('balance', { address: account.address });
        
        // Parse balance response - response is already an array of tokens
        const balanceData = result?.response || result;
        
        if (balanceData && Array.isArray(balanceData)) {
          for (const token of balanceData) {
            // Skip MINIMA (0x00)
            if (token.tokenid === '0x00') continue;
            
            const tokenid = token.tokenid;
            
            if (tokensMap.has(tokenid)) {
              // Aggregate existing token balance - use confirmed instead of total
              const existing = tokensMap.get(tokenid)!;
              existing.confirmed = this.addDecimalStrings(existing.confirmed, token.confirmed || '0');
              existing.sendable = this.addDecimalStrings(existing.sendable, token.sendable || '0');
              // NOTE: Keep total for metadata but it represents total supply, not balance
              existing.total = token.total || existing.total || '0';
            } else {
              // Add new token
              tokensMap.set(tokenid, {
                ...token,
                confirmed: token.confirmed || '0',
                sendable: token.sendable || '0',
                // NOTE: total represents token supply, not user's balance
                total: token.total || '0'
              });
            }
          }
          successCount++;
        }
      } catch (error) {
        // Log and continue - gracefully handle per-address failures
        WalletLogger.warn(` Failed to fetch tokens for address ${i}, continuing...`, error);
        failCount++;
        // Don't throw - continue with other addresses
      }
    }
    
    const tokens = Array.from(tokensMap.values());
    WalletLogger.info(` Token aggregation complete: ${successCount} success, ${failCount} failed, ${tokens.length} unique tokens`);
    return tokens;
  }

  /**
   * Get WOTS key health status from Axia API
   * Returns healthy/warning/critical based on key pool depletion
   * 
   * @returns Health status object with percentage and classification
   * @throws {AxiaError|QuotaExceededError|NetworkError} On RPC failures
   */
  async getWotsHealth(): Promise<{ health: number; status: 'healthy' | 'warning' | 'critical'; remainingSignatures: number }> {
    WalletLogger.info(' Querying WOTS health from Axia API...');
    
    const rpcClient = this.getRpcClient();
    
    try {
      // Query WOTS status from Axia API
      // The wots/status method returns current watermark and usage statistics
      const { result } = await rpcClient.call<any>('wots/status', {});
      
      const statusData = result?.response || result;
      
      // Validate response structure before using
      if (!statusData || typeof statusData !== 'object') {
        WalletLogger.warn(' Invalid WOTS status response, using local state');
        throw new Error('Invalid WOTS response structure');
      }
      
      // Parse WOTS health metrics with validation
      const signatureCount = typeof statusData.signaturesUsed === 'number' 
        ? statusData.signaturesUsed 
        : this.state.wots.signatureCount || 0;
      
      const maxSignatures = typeof statusData.maxSignatures === 'number'
        ? statusData.maxSignatures
        : 262144; // Default: 64^3
      
      // Validate numbers are not NaN/Infinity
      if (!Number.isFinite(signatureCount) || !Number.isFinite(maxSignatures) || maxSignatures === 0) {
        WalletLogger.warn(' Invalid WOTS metrics, using local state');
        throw new Error('Invalid WOTS metrics');
      }
      
      const remainingSignatures = maxSignatures - signatureCount;
      
      // Calculate health percentage
      const usagePercent = (signatureCount / maxSignatures) * 100;
      const health = Math.max(0, Math.min(100, 100 - usagePercent));
      
      // Determine status classification
      let status: 'healthy' | 'warning' | 'critical';
      if (health >= 50) {
        status = 'healthy';
      } else if (health >= 15) {
        status = 'warning';
      } else {
        status = 'critical';
      }
      
      // Update local state only if values are valid
      this.state.wots.signatureCount = signatureCount;
      this.state.wots.remainingSignatures = remainingSignatures;
      this.state.wots.keyHealth = health;
      
      WalletLogger.info(' WOTS Health:', { health, status, remainingSignatures });
      
      return { health, status, remainingSignatures };
    } catch (error) {
      WalletLogger.warn(' Failed to query WOTS health, using local state:', error);
      
      // Fallback to local state if API unavailable
      const health = this.state.wots.keyHealth;
      const status: 'healthy' | 'warning' | 'critical' = 
        health >= 50 ? 'healthy' : health >= 15 ? 'warning' : 'critical';
      
      return {
        health,
        status,
        remainingSignatures: this.state.wots.remainingSignatures
      };
    }
  }

  /**
   * Get transaction history for user's addresses
   * Returns recent transactions with status, timestamp, and amount
   * 
   * @param limit - Maximum number of transactions to return (default: 50)
   * @returns Array of transactions sorted by timestamp (newest first)
   * @throws {AxiaError|QuotaExceededError|NetworkError} On RPC failures
   */
  async getTransactionHistory(limit: number = 50): Promise<Transaction[]> {
    WalletLogger.info(' Fetching transaction history for all addresses...');
    
    const rpcClient = this.getRpcClient();
    const allTransactions: Transaction[] = [];
    
    // Query recent transactions for each address
    // Note: Querying all 64 addresses would be expensive, so we'll query just active addresses
    const activeAddresses = await this.getNonExcludedAddresses();
    
    for (const account of activeAddresses.slice(0, 10)) { // Limit to first 10 addresses to conserve quota
      try {
        const { result } = await rpcClient.call<any>('history', { 
          address: account.address,
          limit: Math.ceil(limit / 10) // Distribute limit across addresses
        });
        
        const historyData = result?.response || result;
        
        if (historyData && Array.isArray(historyData.txns)) {
          for (const tx of historyData.txns) {
            allTransactions.push({
              id: tx.txpowid || tx.txid || tx.id,
              from: tx.from || account.address,
              to: tx.to || tx.outputs?.[0]?.address || '',
              amount: tx.amount || tx.value || '0',
              fee: tx.fee || tx.burn || '0',
              status: this.mapTxStatus(tx.status || tx.state),
              timestamp: tx.timestamp || tx.time || Date.now(),
              tokenId: tx.tokenid || undefined,
              burn: tx.burn || undefined
            });
          }
        }
      } catch (error) {
        WalletLogger.warn(` Failed to fetch history for ${account.address}, continuing...`, error);
        // Continue with other addresses instead of throwing
      }
    }
    
    // Sort by timestamp (newest first) and apply limit
    const sorted = allTransactions
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    
    WalletLogger.info(`Loaded ${sorted.length} transactions`);
    return sorted;
  }

  /**
   * Map various transaction status formats to standard status
   */
  private mapTxStatus(status: string | undefined): 'pending' | 'confirmed' | 'failed' {
    if (!status) return 'pending';
    
    const normalized = status.toLowerCase();
    
    if (normalized.includes('confirm') || normalized === 'valid' || normalized === 'success') {
      return 'confirmed';
    }
    if (normalized.includes('fail') || normalized === 'invalid') {
      return 'failed';
    }
    
    return 'pending';
  }

  /**
   * Add two decimal strings with full precision preservation
   */
  private addDecimalStrings(a: string, b: string): string {
    try {
      const cleanA = (a || '0').trim();
      const cleanB = (b || '0').trim();
      
      const getFractionalLength = (num: string): number => {
        const parts = num.split('.');
        return parts[1]?.length || 0;
      };
      
      const precision = Math.max(getFractionalLength(cleanA), getFractionalLength(cleanB));
      
      if (precision === 0) {
        return (BigInt(cleanA) + BigInt(cleanB)).toString();
      }
      
      const scale = BigInt('1' + '0'.repeat(precision));
      
      const scaleDecimal = (num: string): bigint => {
        const [whole = '0', frac = ''] = num.split('.');
        const paddedFrac = frac.padEnd(precision, '0');
        return BigInt(whole) * scale + BigInt(paddedFrac);
      };
      
      const descaleDecimal = (scaled: bigint): string => {
        const whole = scaled / scale;
        const frac = (scaled % scale).toString().padStart(precision, '0');
        const trimmedFrac = frac.replace(/0+$/, '');
        return trimmedFrac ? `${whole}.${trimmedFrac}` : whole.toString();
      };
      
      const scaledA = scaleDecimal(cleanA);
      const scaledB = scaleDecimal(cleanB);
      const sum = scaledA + scaledB;
      
      return descaleDecimal(sum);
    } catch (error) {
      console.error('Decimal addition error:', error, 'inputs:', a, b);
      return '0';
    }
  }

  /**
   * Fetch combined balances for all active view addresses
   */
  async fetchBalances(): Promise<void> {
    const addresses = await this.getActiveViewAddresses();
    
    const allTokens: Map<string, Token> = new Map();
    
    for (const account of addresses) {
      const tokens = await this.fetchAddressBalance(account.address);
      
      tokens.forEach(token => {
        const existingToken = allTokens.get(token.tokenid);
        
        if (existingToken) {
          const sendable = this.addDecimalStrings(existingToken.sendable || '0', token.sendable || '0');
          const confirmed = this.addDecimalStrings(existingToken.confirmed || '0', token.confirmed || '0');
          const unconfirmed = this.addDecimalStrings(existingToken.unconfirmed || '0', token.unconfirmed || '0');
          
          allTokens.set(token.tokenid, {
            ...existingToken,
            sendable,
            confirmed,
            unconfirmed
          });
        } else {
          allTokens.set(token.tokenid, token);
        }
      });
      
      const nativeToken = tokens.find(t => t.tokenid === '0x00');
      if (nativeToken) {
        account.balance = nativeToken.confirmed;
      }
    }
    
    this.state.tokens = Array.from(allTokens.values());
  }

  /**
   * Get native Minima balance
   */
  getNativeBalance(): string {
    const nativeToken = this.state.tokens.find(t => t.tokenid === '0x00');
    return nativeToken?.confirmed || '0';
  }

  /**
   * Get token balance by tokenId
   */
  getTokenBalance(tokenId: string): Token | undefined {
    return this.state.tokens.find(t => t.tokenid === tokenId);
  }

  /**
   * Get all tokens (excluding native Minima and NFTs)
   */
  getTokens(): Token[] {
    return this.state.tokens.filter(t => 
      t.tokenid !== '0x00' && !this.isNFT(t)
    );
  }

  /**
   * Detect if a token is an NFT
   * NFTs have total supply = 1 and may have an image URL
   */
  isNFT(token: Token): boolean {
    const total = BigInt(token.total || '0');
    return total === BigInt(1);
  }

  /**
   * Get all NFTs
   */
  getNFTs(): Token[] {
    return this.state.tokens.filter(t => this.isNFT(t));
  }

  /**
   * Get token icon/image URL
   * Handles artimage embedded format and url field
   */
  getTokenIcon(token: Token): string | undefined {
    if (token.icon) {
      return token.icon;
    }
    
    if (token.url) {
      if (token.url.startsWith('<artimage>')) {
        let base64Data = token.url.replace('<artimage>', '');
        if (base64Data.endsWith('</artimage>')) {
          base64Data = base64Data.slice(0, -'</artimage>'.length).trim();
        }
        return `data:image/jpeg;base64,${base64Data}`;
      }
      
      if (token.url.startsWith('http://') || token.url.startsWith('https://')) {
        return token.url;
      }
      
      if (token.url.startsWith('ipfs://')) {
        return `https://ipfs.io/ipfs/${token.url.replace('ipfs://', '')}`;
      }
    }
    
    return undefined;
  }

  /**
   * Get display name for token
   */
  getTokenDisplayName(token: Token): string {
    if (token.tokenid === '0x00') {
      return 'Minima';
    }
    
    return token.name || token.ticker || token.token || `Token ${token.tokenid.slice(0, 8)}...`;
  }

  /**
   * Get display symbol for token
   */
  getTokenDisplaySymbol(token: Token): string {
    if (token.tokenid === '0x00') {
      return 'MINIMA';
    }
    
    return token.ticker || token.token || token.tokenid.slice(0, 8);
  }

  /**
   * Save address metadata (names) to storage
   */
  private async saveAddressMetadata(): Promise<void> {
    const addressNames: Record<number, string> = {};
    this.state.accounts.forEach(account => {
      addressNames[account.index] = account.name;
    });
    
    await chrome.storage.local.set({ addressNames });
  }

  /**
   * Load address metadata (names) from storage
   */
  private async loadAddressMetadata(): Promise<void> {
    const stored = await chrome.storage.local.get('addressNames');
    if (stored.addressNames) {
      const addressNames = stored.addressNames as Record<number, string>;
      this.state.accounts.forEach(account => {
        if (addressNames[account.index]) {
          account.name = addressNames[account.index];
        }
      });
    }
  }

  /**
   * Restore addresses from chrome.storage (used when wallet manager is instantiated fresh)
   * CRITICAL FIX: This ensures addresses are available after page reload
   */
  private async restoreAddressesFromStorage(): Promise<void> {
    WalletLogger.info(' Restoring addresses from storage...');
    const stored = await chrome.storage.local.get(['walletAddresses', 'addressGenerationComplete']);
    
    if (stored.walletAddresses && Array.isArray(stored.walletAddresses)) {
      this.state.accounts = stored.walletAddresses as Account[];
      this.state.activeAccount = this.state.accounts[0]?.address || '';
      this.addressGenerationComplete = stored.addressGenerationComplete === true;
      
      WalletLogger.info(` ✅ Restored ${this.state.accounts.length} address(es) from storage`);
      
      // Also load metadata (custom names) if available
      await this.loadAddressMetadata();
    } else {
      WalletLogger.warn(' ⚠️ No addresses found in storage - wallet may not be initialized');
    }
  }

  // Private helper methods

  /**
   * On-demand address model: 1 address generated at wallet creation.
   * Additional addresses are added via addNextAddress() from Settings.
   */
  private static readonly YIELD_INTERVAL_MS = 10;

  private backgroundGenerationActive = false;
  private backgroundGenerationCancelled = false;

  private addressGenerationComplete = true; // Always complete — on-demand model

  /**
   * Smart unlock: restore addresses from storage, create TreeKey for signing.
   * On-demand model — no background generation needed.
   */
  private async unlockWithSmartRestore(baseSeed: Uint8Array): Promise<void> {
    this.backgroundGenerationActive = false;
    this.backgroundGenerationCancelled = false;

    const stored = await chrome.storage.local.get(['walletAddresses']);
    const existingAddresses = stored.walletAddresses as Account[] | undefined;
    const addressCount = existingAddresses?.length ?? 0;

    if (existingAddresses && addressCount > 0) {
      WalletLogger.info(` ✓ Restoring ${addressCount} address(es) from storage`);
      this.state.accounts = existingAddresses;
      this.state.activeAccount = existingAddresses[0]?.address || '';
      this.addressGenerationComplete = true;

      const treeKey = await TreeKey.createWithProgress(baseSeed, 64, 3);
      this.sessionTreeKey = treeKey;
      const rootPubkey = treeKey.getRootPublicKey();
      this.setRootPublicKeyAndIdentity(`0x${this.bytesToHex(rootPubkey)}`);

      WalletLogger.info(` ✓ TreeKey ready, ${addressCount} address(es) available`);
      return;
    }

    // No addresses — fresh wallet creation
    WalletLogger.info(' No addresses found — generating first address');
    await this.generateAllAddresses(baseSeed);
  }

  /**
   * Generate the initial address set (on-demand model: 1 address).
   * Creates TreeKey from baseSeed, derives address[0], persists to storage.
   */
  private async generateAllAddresses(baseSeed: Uint8Array, onProgress?: ProgressCallback): Promise<void> {
    WalletLogger.info(' Generating first address (on-demand model)');
    this.state.accounts = [];
    this.backgroundGenerationCancelled = false;

    try {
      const treeKeyStartTime = performance.now();
      WalletLogger.info(' Building TreeKey (64×64×64 = 262,144 one-time signatures)...');

      const treeKey = await TreeKey.createWithProgress(baseSeed, 64, 3, onProgress);
      this.sessionTreeKey = treeKey;

      const treeKeyTime = performance.now() - treeKeyStartTime;
      WalletLogger.info(` ✓ TreeKey built in ${treeKeyTime.toFixed(0)}ms`);

      const rootPubkey = treeKey.getRootPublicKey();
      this.setRootPublicKeyAndIdentity(`0x${this.bytesToHex(rootPubkey)}`);

      WalletLogger.info(' Deferring signature cache restoration until first sign operation');

      const { address, publicKey } = this.deriveAddressFromSeed(baseSeed, 0);
      WalletLogger.info(` Address[0] → ${address.substring(0, 20)}...`);

      const accounts: Account[] = [{
        address,
        name: '#1',
        index: 0,
        publicKey,
        balance: '0',
      }];

      this.state.accounts = accounts;
      this.state.activeAccount = address;
      this.addressGenerationComplete = true;

      await chrome.storage.local.set({ walletAddresses: this.state.accounts });
      WalletLogger.info(' ✅ Address persisted to storage');

      if (onProgress) {
        onProgress({
          phase: 'address_derive',
          current: 1,
          total: 1,
          message: 'Wallet ready!',
        });
      }

      await this.loadAddressMetadata();
    } catch (error) {
      this.backgroundGenerationActive = false;
      WalletLogger.error(`Address generation failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  /**
   * Add the next address on demand (MetaMask-style).
   */
  public async addNextAddress(): Promise<Account> {
    if (!this.sessionSeed) throw new Error('Wallet locked');
    const index = this.state.accounts.length;
    const { address, publicKey } = this.deriveAddressFromSeed(this.sessionSeed, index);
    const newAccount: Account = {
      address,
      name: `#${index + 1}`,
      index,
      publicKey,
      balance: '0',
    };
    this.state.accounts.push(newAccount);
    await chrome.storage.local.set({ walletAddresses: this.state.accounts });
    WalletLogger.info(` ✓ Added address[${index}]: ${address.substring(0, 20)}...`);
    return newAccount;
  }

  /**
   * Get available address count.
   */
  public getAvailableAddressCount(): number {
    return this.state.accounts.length;
  }

  /**
   * Check if address generation is complete (always true in on-demand model).
   */
  public isAddressGenerationComplete(): boolean {
    return true;
  }

  /**
   * Cancel background generation (no-op in on-demand model).
   */
  public cancelBackgroundGeneration(): void {
    // no-op
  }

  /**
   * @deprecated No-op — on-demand model requires no auto-resume.
   */
  public async autoResumeGenerationOnStartup(): Promise<void> {
    WalletLogger.info(' autoResumeGenerationOnStartup: no-op (on-demand address model)');
    return;
  }

  /**
   * @deprecated No-op in on-demand model.
   */
  public async handleGenerationKeepaliveAlarm(): Promise<void> {
    return;
  }

  private async encryptAndStoreSeed(seed: Uint8Array, password: string): Promise<void> {
    const key = await this.deriveKey(password);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      seed as BufferSource
    );
    
    const seedFingerprint = this.computeSeedFingerprint(seed);
    WalletLogger.debug(`Storing seed with fingerprint: ${seedFingerprint}`);
    
    await chrome.storage.local.set({
      encryptedSeed: {
        iv: this.bytesToHex(iv),
        ct: this.bytesToHex(new Uint8Array(ct))
      },
      seedFingerprint
    });
  }
  
  private computeSeedFingerprint(seed: Uint8Array): string {
    const hash = sha3_256(seed);
    return this.bytesToHex(hash.slice(0, 6));
  }

  private async encryptAndStoreMnemonic(mnemonic: string, password: string): Promise<void> {
    const key = await this.deriveKey(password);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const mnemonicBytes = enc.encode(mnemonic);
    
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      mnemonicBytes as BufferSource
    );
    
    await chrome.storage.local.set({
      encryptedMnemonic: {
        iv: this.bytesToHex(iv),
        ct: this.bytesToHex(new Uint8Array(ct))
      }
    });
  }

  async exportMnemonic(password: string): Promise<string> {
    const stored = await chrome.storage.local.get('encryptedMnemonic');
    
    if (!stored.encryptedMnemonic) {
      throw new Error('No mnemonic stored');
    }
    
    const { iv, ct } = stored.encryptedMnemonic;
    const key = await this.deriveKey(password);
    const ivBytes = this.hexToBytes(iv);
    const ctBytes = this.hexToBytes(ct);
    
    try {
      const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBytes as BufferSource },
        key,
        ctBytes as BufferSource
      );
      
      const dec = new TextDecoder();
      return dec.decode(pt);
    } catch {
      throw new Error('Invalid password');
    }
  }

  private async decryptSeed(ivHex: string, ctHex: string, password: string): Promise<Uint8Array | null> {
    try {
      const key = await this.deriveKey(password);
      const iv = this.hexToBytes(ivHex);
      const ct = this.hexToBytes(ctHex);
      
      const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        ct as BufferSource
      );
      
      return new Uint8Array(pt);
    } catch {
      return null;
    }
  }

  private async deriveKey(password: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    const salt = enc.encode('Totem.salt.v1');
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }


  /**
   * Derive address using unified hierarchical key derivation (2026-06).
   * child_seed_i = SHA3-256(root_priv_seed ‖ indexBytes(i))
   */
  private deriveAddressFromSeed(baseSeed: Uint8Array, addressIndex: number): { address: string; publicKey: string } {
    const addressPubkey = deriveUnifiedAddressPublicKey(baseSeed, addressIndex);
    const publicKeyHex = `0x${this.bytesToHex(addressPubkey)}`;
    const script = scriptFromWotsPk(addressPubkey);
    const address = scriptToAddress(script);
    return { address, publicKey: publicKeyHex };
  }
  
  /**
   * @deprecated Use deriveAddressFromSeed instead. This method used the old master TreeKey architecture.
   */
  private deriveAddressFromTreeKey(treeKey: TreeKey, addressIndex: number): { address: string; publicKey: string } {
    // DEPRECATED: Old architecture used L1 children of a master TreeKey
    // New architecture uses per-address TreeKeys where the root IS the address public key
    WalletLogger.warn('[DEPRECATED] deriveAddressFromTreeKey called - should use deriveAddressFromSeed');
    
    // For backward compatibility, delegate to new method if baseSeed is available
    if (this.sessionSeed) {
      return this.deriveAddressFromSeed(this.sessionSeed, addressIndex);
    }
    
    // Fallback to old behavior if no baseSeed (shouldn't happen)
    const addressPubkey = treeKey.getAddressPublicKey(addressIndex);
    const publicKeyHex = `0x${this.bytesToHex(addressPubkey)}`;
    const script = scriptFromWotsPk(addressPubkey);
    const address = scriptToAddress(script);
    
    return { address, publicKey: publicKeyHex };
  }
  
  /**
   * Get or create per-address TreeKey for signing (2026-02-05)
   * 
   * In the per-address architecture, each address has its own TreeKey.
   * TreeKeys are created lazily and cached for the session to avoid
   * expensive regeneration.
   * 
   * @param addressIndex - Address index (0-63)
   * @returns Per-address TreeKey, or null if wallet is locked
   */
  getPerAddressTreeKey(addressIndex: number): TreeKey | null {
    if (!this.sessionSeed) {
      WalletLogger.error('Cannot get per-address TreeKey: wallet is locked');
      return null;
    }
    
    // Check cache first
    if (this.sessionAddressTreeKeys.has(addressIndex)) {
      return this.sessionAddressTreeKeys.get(addressIndex)!;
    }
    
    WalletLogger.debug(`[Unified] Creating child TreeKey for address ${addressIndex}`);
    const perAddressTreeKey = createUnifiedChildTreeKey(this.sessionSeed, addressIndex);

    this.sessionAddressTreeKeys.set(addressIndex, perAddressTreeKey);
    
    return perAddressTreeKey;
  }
  
  /**
   * Async version with progress reporting for UI
   */
  async getPerAddressTreeKeyAsync(addressIndex: number, onProgress?: ProgressCallback): Promise<TreeKey | null> {
    if (!this.sessionSeed) {
      WalletLogger.error('Cannot get per-address TreeKey: wallet is locked');
      return null;
    }
    
    // Check cache first
    if (this.sessionAddressTreeKeys.has(addressIndex)) {
      return this.sessionAddressTreeKeys.get(addressIndex)!;
    }
    
    WalletLogger.debug(`[Unified] Creating child TreeKey async for address ${addressIndex}`);
    const perAddressTreeKey = await createUnifiedChildTreeKeyAsync(this.sessionSeed, addressIndex, onProgress);

    this.sessionAddressTreeKeys.set(addressIndex, perAddressTreeKey);
    
    return perAddressTreeKey;
  }
  
  /**
   * Clear per-address TreeKey cache (called on lock)
   */
  private clearPerAddressTreeKeyCache(): void {
    this.sessionAddressTreeKeys.clear();
  }


  /**
   * Generate an ownership proof for the given child address indices.
   *
   * Under unified derivation every wallet has a root identity key derived from
   * root_priv_seed. This root key signs a canonical message containing all
   * requested child public keys, enabling third-party verification without
   * network access.
   */
  async generateOwnershipProof(
    _message: string,
    childIndices: number[]
  ): Promise<OwnershipProof> {
    if (!this.sessionSeed) {
      throw new Error('Wallet locked — unlock before generating ownership proof');
    }
    const riw = new RootIdentityWallet(this.sessionSeed, 64);
    const stored = await chrome.storage.local.get('rootTreeRootUses');
    if (stored.rootTreeRootUses != null) {
      riw.setRootUses(Number(stored.rootTreeRootUses));
    }
    const indices = childIndices.length > 0
      ? childIndices
      : Array.from({ length: Math.min(this.state.accounts.length, 64) }, (_, i) => i);
    if (indices.length === 0) {
      throw new Error('No child addresses available — add at least one address first');
    }
    const proof = riw.proveOwnership(indices);
    await chrome.storage.local.set({ rootTreeRootUses: riw.getRootUses() });
    WalletLogger.info(`[OwnershipProof] root=${proof.rootAddress.slice(0, 12)}… children=[${indices.join(',')}]`);
    return proof;
  }

  /**
   * Return Minima spend-addresses for the given child indices.
   * Under unified derivation this resolves via deriveUnifiedChildSeed path.
   */
  getChildAddressesForIndices(indices: number[]): string[] {
    if (!this.sessionSeed) {
      throw new Error('Wallet locked — unlock before querying child addresses');
    }
    const riw = new RootIdentityWallet(this.sessionSeed, 64);
    return indices.map(i => riw.getChildAddress(i));
  }

  /**
   * Return root identity info for the current wallet.
   * Under unified derivation every wallet has a genuine root identity key
   * distinct from all spend addresses.
   */
  getRootIdentityInfo(): { mode: 'AnonTree' | 'RootTree'; rootAddress: string | null; rootPublicKey: string | null } {
    if (!this.sessionSeed) {
      return { mode: 'AnonTree', rootAddress: null, rootPublicKey: null };
    }
    try {
      const riw = new RootIdentityWallet(this.sessionSeed, 64);
      return { mode: 'AnonTree', rootAddress: riw.getRootAddress(), rootPublicKey: riw.getRootPublicKey() };
    } catch {
      return { mode: 'AnonTree', rootAddress: null, rootPublicKey: null };
    }
  }
  
  /**
   * @deprecated LEGACY FLAT ARCHITECTURE - DO NOT USE (2026-02)
   * Legacy address derivation used flat WOTS derivation which is incorrect for per-address TreeKey.
   * Use deriveAddressFromSeed() instead which uses per-address TreeKey architecture.
   */
  private async deriveAddress(seed: Uint8Array, index: number): Promise<string> {
    WalletLogger.error('DEPRECATED: deriveAddress uses legacy flat architecture. Use deriveAddressFromSeed instead.');
    throw new Error('deriveAddress is deprecated - use deriveAddressFromSeed with per-address TreeKey architecture');
  }

  /**
   * CRITICAL FIX: Get the address index for a given address.
   * Used for deriving the correct pkdigest for transaction signing.
   * 
   * Handles address format conversion: coin addresses from MegaMMR are in hex format (0xBB478A...),
   * while wallet addresses are stored in Mx format (MxG0...). Both are converted to hex for comparison.
   */
  getAddressIndex(address: string): number | null {
    // Normalize input address to hex (lowercase, no 0x prefix)
    let inputHex = address;
    if (inputHex.startsWith('Mx')) {
      inputHex = mxToHex(inputHex);
    }
    inputHex = inputHex.replace(/^0x/i, '').toLowerCase();
    
    // Find matching account by converting both to hex
    const account = this.state.accounts.find(acc => {
      let accHex = acc.address;
      if (accHex.startsWith('Mx')) {
        accHex = mxToHex(accHex);
      }
      accHex = accHex.replace(/^0x/i, '').toLowerCase();
      return accHex === inputHex;
    });
    
    if (account) {
      WalletLogger.debug('Found address index', { index: account.index, address: address.slice(0, 16) });
    }
    
    return account ? account.index : null;
  }

  /**
   * @deprecated LEGACY FLAT ARCHITECTURE - DO NOT USE (2026-02)
   * This derives a flat WOTS public key digest which is NOT correct for per-address TreeKey architecture.
   * 
   * For per-address TreeKey architecture, use:
   * - getPerAddressTreeKey(index).getPublicKey() for the correct address public key
   * - Or access account.publicKey which stores the correct per-address TreeKey root
   */
  getPkdigestForIndex(index: number): string | null {
    WalletLogger.error('DEPRECATED: getPkdigestForIndex uses legacy flat architecture. Use getPerAddressTreeKey(index).getPublicKey() instead.');
    throw new Error('getPkdigestForIndex is deprecated - use per-address TreeKey architecture');
  }

  /**
   * @deprecated LEGACY FLAT ARCHITECTURE - DO NOT USE (2026-02)
   * This derives a flat WOTS public key digest which is NOT correct for per-address TreeKey architecture.
   */
  getPkdigestForAddress(address: string): string | null {
    WalletLogger.error('DEPRECATED: getPkdigestForAddress uses legacy flat architecture. Use account.publicKey instead.');
    throw new Error('getPkdigestForAddress is deprecated - use per-address TreeKey architecture');
  }

  /**
   * Get the session seed for transaction signing.
   * Required for per-address WOTS key derivation.
   */
  getSessionSeed(): Uint8Array | null {
    return this.sessionSeed;
  }

  /**
   * Get the cached TreeKey for transaction signing.
   * Returns null if wallet is locked.
   * 
   * The TreeKey provides:
   * - getRootPublicKey(): The level-0 root (for watermark tracking)
   * - getAddressPublicKey(l1Index): Level-1 MMR root (the address public key)
   * - sign(data): Signs via setUses(l1*64+l2) producing 3 proofs (Root→L1→L2→DATA)
   */
  getTreeKey(): TreeKey | null {
    return this.sessionTreeKey;
  }

  /**
   * Get the root public key for this wallet (TreeKey level-0 root).
   * Used for server-side watermark tracking across all addresses.
   */
  getRootPublicKey(): string | null {
    return this.sessionRootPublicKey;
  }

  private notifyKeyRotationNeeded(): void {
    // Send notification to UI
    chrome.runtime.sendMessage({
      type: 'WOTS_ROTATION_NEEDED',
      health: this.state.wots.keyHealth
    });
  }

  /**
   * Request WOTS lease for transaction
   */
  async requestLease(params: any) {
    WalletLogger.debug('Checking session state', {
      locked: this.state.locked,
      sessionSeed: this.sessionSeed ? 'present' : 'null',
      sessionRootPublicKey: this.sessionRootPublicKey ? 'present' : 'null',
      sessionExpired: this.sessionExpired
    });
    
    if (this.state.locked || !this.sessionSeed || !this.sessionRootPublicKey) {
      if (this.sessionExpired) {
        WalletLogger.error('Session expired - service worker restarted');
        throw new Error('SESSION_EXPIRED');
      }
      WalletLogger.error('Wallet locked');
      throw new Error('Wallet locked');
    }
    
    const { TransactionService } = await import('./transaction/service');

    return await TransactionService.prepare(
      params,
      this.sessionRootPublicKey
    );
  }

  /**
   * Sign transaction with WOTS using hierarchical TreeKey
   * 
   * Uses per-address TreeKey.sign() via setUses(l1*64+l2) producing 3 proofs (Root→L1→L2→DATA).
   */
  /**
   * Sign transaction using per-address TreeKey architecture (2026-02-05)
   * 
   * MIGRATION: This method now uses per-address TreeKeys matching Minima exactly.
   * The old (l1, l2, l3) parameters are mapped to (addressIndex, l1, l2):
   * - params.l1 -> addressIndex (which address 0-63)
   * - params.l2 -> l1 (L1 index within per-address TreeKey 0-63)
   * - params.l3 -> l2 (L2 index within per-address TreeKey 0-63)
   */
  async signTransaction(params: any) {
    // Map legacy (l1, l2, l3) to per-address format (addressIndex, l1, l2)
    const addressIndex = params.l1;
    const l1 = params.l2;
    const l2 = params.l3;
    
    const seedFp = this.sessionSeed ? this.computeSeedFingerprint(this.sessionSeed) : 'NO_SEED';
    WalletLogger.debug(`SIGNING FINGERPRINT CHECK: fp=${seedFp}, addressIndex=${addressIndex}, l1=${l1}, l2=${l2}`);
    
    // CORE_BUILD_ID CHECK for bundle duplication detection
    try {
      const { CORE_BUILD_ID } = await import('../../../totem-sdk/packages/core/src/version');
      console.log(`[WALLET:SIGN] CORE_BUILD_ID: ${CORE_BUILD_ID}`);
    } catch (e) {
      console.warn('[WALLET:SIGN] Could not load CORE_BUILD_ID');
    }
    
    WalletLogger.info('PER-ADDRESS TREEKEY SIGNING (2026-02-05)', {
      addressIndex,
      path: `l1=${l1}, l2=${l2}`,
      legacyPath: `(was l1=${params.l1}, l2=${params.l2}, l3=${params.l3})`,
      digest: params.digestTx?.slice(0, 20),
      locked: this.state.locked,
      sessionSeed: this.sessionSeed ? 'present' : 'null',
      expired: this.sessionExpired
    });
    
    if (this.state.locked || !this.sessionSeed) {
      if (this.sessionExpired) {
        WalletLogger.error('Session expired - service worker restarted');
        throw new Error('SESSION_EXPIRED');
      }
      WalletLogger.error('Wallet locked');
      throw new Error('Wallet locked');
    }
    
    // Delegate to per-address signing
    return this.signTransactionPerAddress({
      addressIndex,
      l1,
      l2,
      digestTx: params.digestTx
    });
  }
  
  /**
   * Sign transaction using per-address TreeKey architecture (2026-02-05)
   * 
   * This is the new signing method that uses per-address TreeKeys matching
   * Minima Wallet.createNewKey() exactly.
   * 
   * @param params - Sign request with addressIndex, l1, l2, digestTx
   * @returns Hierarchical witness bundle and signed hex
   */
  async signTransactionPerAddress(params: { addressIndex: number; l1: number; l2: number; digestTx: string }) {
    if (this.state.locked || !this.sessionSeed) {
      if (this.sessionExpired) {
        WalletLogger.error('Session expired - service worker restarted');
        throw new Error('SESSION_EXPIRED');
      }
      WalletLogger.error('Wallet locked');
      throw new Error('Wallet locked');
    }
    
    const { addressIndex, l1, l2, digestTx } = params;
    
    if (typeof addressIndex !== 'number' || isNaN(addressIndex)) {
      const errMsg = `INVALID_ADDRESS_INDEX: addressIndex=${JSON.stringify(addressIndex)} (type: ${typeof addressIndex}). Must be a number 0-63. This indicates a mapping issue in the prepare→sign pipeline.`;
      WalletLogger.error(errMsg);
      throw new Error(errMsg);
    }
    
    if (typeof l1 !== 'number' || typeof l2 !== 'number' || isNaN(l1) || isNaN(l2)) {
      const errMsg = `INVALID_SIGNING_INDICES: l1=${l1} (${typeof l1}), l2=${l2} (${typeof l2}). Both must be valid numbers. This usually means signTransaction() legacy remapping was used with new-style {addressIndex,l1,l2} params.`;
      WalletLogger.error(errMsg);
      throw new Error(errMsg);
    }
    
    // FINGERPRINT CHECK: Log seed fingerprint before signing (recommendation #1)
    const seedFp = this.computeSeedFingerprint(this.sessionSeed);
    WalletLogger.info(`SIGNING with seed fingerprint: ${seedFp}, addressIndex=${addressIndex}, l1=${l1}, l2=${l2}`);
    
    // CORE_BUILD_ID CHECK: Detect bundle duplication (recommendation #5)
    try {
      const { CORE_BUILD_ID } = await import('../../../totem-sdk/packages/core/src/version');
      WalletLogger.debug(`SIGNING: CORE_BUILD_ID=${CORE_BUILD_ID}`);
    } catch (e) {
      WalletLogger.warn('Could not load CORE_BUILD_ID - bundle check skipped');
    }
    
    // CRITICAL ASSERTION: Verify addressIndex is 0-based (0-63) not 1-based (1-64)
    if (addressIndex < 0 || addressIndex >= 64) {
      const errMsg = `INDEX_OUT_OF_RANGE: addressIndex ${addressIndex} is not in valid range 0-63. Possible off-by-one error between UI (1-64) and internal (0-63) indexing!`;
      WalletLogger.error(errMsg);
      throw new Error(errMsg);
    }
    
    // CRITICAL ASSERTION: Verify the TreeKey's public key matches the stored account's public key
    // This catches off-by-one errors where we derive TreeKey for wrong address
    const storedAccount = this.state.accounts.find(acc => acc.index === addressIndex);
    if (!storedAccount) {
      const errMsg = `ACCOUNT_NOT_FOUND: No account found with index ${addressIndex}. UI shows "Address ${addressIndex + 1}".`;
      WalletLogger.error(errMsg);
      throw new Error(errMsg);
    }
    
    // Get or create per-address TreeKey
    const perAddressTreeKey = this.getPerAddressTreeKey(addressIndex);
    if (!perAddressTreeKey) {
      WalletLogger.error(`Failed to get per-address TreeKey for address ${addressIndex}`);
      throw new Error('Failed to get per-address TreeKey');
    }
    
    // Verify the TreeKey's root public key matches the stored account's public key
    const treeKeyPubkey = perAddressTreeKey.getPublicKey();
    const treeKeyPubkeyHex = `0x${this.bytesToHex(treeKeyPubkey)}`;
    const storedPubkeyHex = storedAccount.publicKey;
    
    if (treeKeyPubkeyHex.toLowerCase() !== storedPubkeyHex.toLowerCase()) {
      const errMsg = `PUBKEY_MISMATCH_AT_SIGNING: TreeKey[${addressIndex}] pubkey does not match stored account[${addressIndex}] pubkey!
  TreeKey derived: ${treeKeyPubkeyHex.slice(0, 24)}...
  Stored account:  ${storedPubkeyHex.slice(0, 24)}...
  This indicates a seed/derivation mismatch or index error.`;
      WalletLogger.error(errMsg);
      throw new Error(errMsg);
    }
    
    WalletLogger.info(`SIGNING ASSERTION PASSED: TreeKey pubkey matches stored account pubkey for address ${addressIndex} (UI: "Address ${addressIndex + 1}")`);
    
    WalletLogger.debug(`Per-address TreeKey available for address ${addressIndex}, delegating to TransactionService.signWithPerAddressTreeKey()`);
    const { TransactionService } = await import('./transaction/service');
    const result = await TransactionService.signWithPerAddressTreeKey(
      { addressIndex, l1, l2, digestTx },
      perAddressTreeKey
    );
    
    WalletLogger.info('Per-address signing complete', {
      addressIndex,
      proofs: result.witnessBundle.proofs.length,
      rootPK: result.witnessBundle.rootPublicKey?.slice(0, 20)
    });
    
    return result;
  }
  
  /**
   * Finalize signed transaction
   */
  async finalizeTransaction(params: any) {
    const { TransactionService } = await import('./transaction/service');
    return await TransactionService.finalize(params);
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private hexToBytes(hex: string): Uint8Array {
    const matches = hex.match(/.{1,2}/g) || [];
    return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
  }

  // ============================================================================
  // Multi-Step Initialization API
  // These methods break wallet creation into smaller steps to avoid message
  // channel timeouts in Chrome extension messaging
  // ============================================================================

  /**
   * Step 1: Validate mnemonic (for import) or generate new one (for create)
   * Fast operation - no crypto work
   */
  initStep1_ValidateMnemonic(mnemonic?: string): { valid: boolean; mnemonic: string; error?: string } {
    if (mnemonic) {
      if (!validateMnemonic(mnemonic)) {
        return { valid: false, mnemonic: '', error: 'Invalid mnemonic phrase' };
      }
      return { valid: true, mnemonic };
    }
    const newMnemonic = generateMnemonic();
    return { valid: true, mnemonic: newMnemonic };
  }

  /**
   * Step 2: Derive encryption key from password using PBKDF2
   * ~1-2 seconds with 200k iterations
   * Returns the key as exportable for storage in session
   */
  async initStep2_DeriveKey(password: string): Promise<{ keyHex: string }> {
    WalletLogger.info(' Step 2: Deriving encryption key (PBKDF2 200k rounds)...');
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    const salt = enc.encode('Totem.salt.v1');
    const keyBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
      baseKey,
      256
    );
    
    const keyHex = this.bytesToHex(new Uint8Array(keyBits));
    WalletLogger.info(' Step 2 complete: Key derived');
    return { keyHex };
  }

  /**
   * Step 3: Convert mnemonic to baseSeed using Minima's method
   * Minima-compatible: SHA3-256(cleanSeedPhrase(mnemonic)) - no PBKDF2, no HKDF
   */
  async initStep3_DeriveSeed(mnemonic: string): Promise<{ baseSeedHex: string }> {
    WalletLogger.info(' Step 3: Converting mnemonic to seed (Minima SHA3-256)...');
    const baseSeed = mnemonicToSeed(mnemonic);
    const baseSeedHex = this.bytesToHex(baseSeed);
    WalletLogger.info(' Step 3 complete: Base seed derived');
    return { baseSeedHex };
  }

  /**
   * Step 4: Generate TreeKey and all 64 addresses
   * This is the main work - uses internal progress callbacks
   */
  async initStep4_GenerateTreeKey(baseSeedHex: string, onProgress?: ProgressCallback): Promise<{ addressCount: number }> {
    WalletLogger.info(' Step 4: Generating TreeKey and addresses...');
    const baseSeed = this.hexToBytes(baseSeedHex);
    await this.generateAllAddresses(baseSeed, onProgress);
    WalletLogger.info(`Step 4 complete: Generated ${this.state.accounts.length} addresses`);
    return { addressCount: this.state.accounts.length };
  }

  /**
   * Step 5: Encrypt and store everything, finalize wallet
   */
  async initStep5_Finalize(
    mnemonic: string,
    password: string,
    baseSeedHex: string
  ): Promise<{ address: string; success: boolean }> {
    WalletLogger.info(' Step 5: Encrypting and storing wallet...');
    const baseSeed = this.hexToBytes(baseSeedHex);
    
    await this.encryptAndStoreSeed(baseSeed, password);
    await this.encryptAndStoreMnemonic(mnemonic, password);
    
    this.state.locked = false;
    this.sessionSeed = baseSeed;
    
    await chrome.storage.local.set({ walletSetup: true });
    
    WalletLogger.info('Step 5 complete: Wallet finalized');
    WalletLogger.debug(`First address: ${this.state.accounts[0]?.address?.substring(0, 20)}...`);
    
    return { 
      address: this.state.accounts[0]?.address || '', 
      success: true 
    };
  }
}

// Export singleton instance
export const walletManager = new WalletManager();