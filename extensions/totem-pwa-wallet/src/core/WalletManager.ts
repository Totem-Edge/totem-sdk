/**
 * WalletManager — core wallet logic for the PWA.
 *
 * Key behaviours:
 * - Only address[0] is derived on setup. Additional addresses on-demand.
 * - Session seed lives in-memory only. Cleared on lock().
 * - Uses VaultStore (IndexedDB AES-256-GCM) for persistence.
 * - createUnifiedChildTreeKeyAsync is used for ALL key derivation.
 * - addNextAddress() uses a dedicated Web Worker (keyworker.ts) so derivation
 *   runs off the main thread — keeps the UI responsive during the ~2-5 s operation.
 * - _pendingMnemonic held in memory until backup confirmed, then cleared.
 */
import {
  phraseToSeed,
  generateWordList,
  validatePhrase,
  scriptFromWotsPk,
  scriptToAddress,
  createUnifiedChildTreeKeyAsync,
  TreeKey,
  type SignatureProof,
} from '@totemsdk/core';
import { VaultStore, type AccountRecord } from '../stores/VaultStore';
import { SigCacheStore } from '../stores/SigCacheStore';
import { computeIdentityHash, fetchWatermark } from './api';
import { toHex } from './utils';

export interface SessionState {
  seed: Uint8Array;
  rootPublicKey: string;
  identityHash: string;
  accounts: AccountRecord[];
  activeIndex: number;
}

let _session: SessionState | null = null;

/** Temporary storage for the just-created mnemonic — cleared after backup confirmed */
let _pendingMnemonic: string | null = null;

/** Cached TreeKeys for the active session (index → TreeKey) */
const _treeKeyCache = new Map<number, TreeKey>();

// ── Web Worker for off-main-thread address derivation ──────────────────────
let _keyWorker: Worker | null = null;
let _workerReady = false;

function getKeyWorker(): Worker {
  if (!_keyWorker || !_workerReady) {
    _keyWorker = new Worker(new URL('../workers/keyworker.ts', import.meta.url), { type: 'module' });
    _workerReady = true;
  }
  return _keyWorker;
}

function deriveAddressViaWorker(
  seed: Uint8Array,
  index: number
): Promise<{ address: string; publicKey: string }> {
  return new Promise((resolve, reject) => {
    const reqId = `derive_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const worker = getKeyWorker();

    const onMsg = (e: MessageEvent) => {
      if (e.data.reqId !== reqId) return;
      worker.removeEventListener('message', onMsg);
      if (e.data.type === 'error') {
        reject(new Error(e.data.error));
      } else {
        resolve({ address: e.data.address, publicKey: e.data.publicKey });
      }
    };

    worker.addEventListener('message', onMsg);
    worker.postMessage({ type: 'derive', baseSeed: Array.from(seed), index, reqId });
  });
}

// ── Main-thread derivation (for index 0 at setup, and for signing) ──────────
async function deriveAddressMain(seed: Uint8Array, index: number): Promise<AccountRecord> {
  const treeKey = await createUnifiedChildTreeKeyAsync(seed, index);
  const pubKey  = treeKey.getPublicKey() as Uint8Array;
  const script  = scriptFromWotsPk(pubKey);
  const address = scriptToAddress(script);
  _treeKeyCache.set(index, treeKey);
  return { index, address, publicKey: toHex(pubKey), name: `Account ${index + 1}` };
}

/**
 * Derive the wallet-level root public key for WOTS watermark and quota tracking.
 *
 * CRITICAL — must match the extension wallet.ts derivation exactly:
 *   const treeKey = await TreeKey.createWithProgress(baseSeed, 64, 3);
 *   const rootPubkey = treeKey.getRootPublicKey();
 *   sessionRootPublicKey = `0x${bytesToHex(rootPubkey)}`;
 *
 * The extension creates TreeKey DIRECTLY from the baseSeed (not a child-derived
 * seed). Using createUnifiedChildTreeKey(seed, 0) is wrong because it first
 * runs deriveUnifiedChildSeed(seed, 0) which produces a DIFFERENT 32-byte seed.
 *
 * Why: the watermark namespace and quota bucket must be the same across all
 * devices/clients for the same wallet. This is achieved by using the raw-seed
 * TreeKey root as the stable identity anchor.
 */
async function computeRootPublicKey(seed: Uint8Array): Promise<string> {
  const rootTk = await TreeKey.createWithProgress(seed, 64, 3);
  return `0x${toHex(rootTk.getRootPublicKey())}`;
}

export const WalletManager = {
  generateMnemonic(): string {
    return generateWordList().join(' ').toUpperCase();
  },

  validateMnemonic(mnemonic: string): boolean {
    const wordCount = mnemonic.trim().split(/\s+/).length;
    if (wordCount !== 24) return false;
    return validatePhrase(mnemonic);
  },

  /**
   * Create a new wallet — derives address[0] on main thread so the TreeKey is
   * immediately available for signing. Saves vault + account[0].
   * _pendingMnemonic is held until confirmBackup() is called.
   */
  async createWallet(mnemonic: string, password: string): Promise<void> {
    const seed = phraseToSeed(mnemonic);
    // Derive address[0] and the root public key in parallel for speed.
    // computeRootPublicKey uses TreeKey(baseSeed) — NOT a child-derived seed —
    // matching the extension's watermark/identity anchor.
    const [account0, rootPublicKey] = await Promise.all([
      deriveAddressMain(seed, 0),
      computeRootPublicKey(seed),
    ]);

    await VaultStore.saveWallet(mnemonic, seed, password);
    await VaultStore.addAccount(account0);

    const identityHash = computeIdentityHash(rootPublicKey);

    _session = { seed, rootPublicKey, identityHash, accounts: [account0], activeIndex: 0 };
    _pendingMnemonic = mnemonic;
  },

  /**
   * Import an existing wallet from seed phrase — identical to createWallet but
   * immediately marks backup confirmed (user already has the phrase) so the
   * flow goes straight to home without the backup quiz step.
   */
  async importWallet(mnemonic: string, password: string): Promise<void> {
    const seed = phraseToSeed(mnemonic);
    const [account0, rootPublicKey] = await Promise.all([
      deriveAddressMain(seed, 0),
      computeRootPublicKey(seed),
    ]);

    await VaultStore.saveWallet(mnemonic, seed, password);
    await VaultStore.addAccount(account0);
    await VaultStore.setBackupConfirmed(); // import = user already has the phrase

    const identityHash = computeIdentityHash(rootPublicKey);

    _session = { seed, rootPublicKey, identityHash, accounts: [account0], activeIndex: 0 };
  },

  getPendingMnemonic(): string | null { return _pendingMnemonic; },
  clearPendingMnemonic(): void { _pendingMnemonic = null; },

  /**
   * Reveal the wallet's seed phrase from encrypted storage.
   * Requires the current wallet password for decryption.
   * Throws if the wallet was created before phrase storage was added (v1.1).
   */
  async revealMnemonic(password: string): Promise<string> {
    return VaultStore.loadMnemonic(password);
  },

  /** Unlock — restores session; no TreeKey cached until getActiveTreeKey() is called */
  async unlock(password: string): Promise<void> {
    const seed     = await VaultStore.loadSeed(password);
    const accounts = await VaultStore.getAccounts();
    if (accounts.length === 0) throw new Error('No accounts found');

    // Compute the watermark-tracking root from TreeKey(seed) — same derivation
    // as the extension. TreeKey cache starts empty; keys are loaded lazily on
    // first sign (getActiveTreeKey()).
    const rootPublicKey = await computeRootPublicKey(seed);
    const identityHash  = computeIdentityHash(rootPublicKey);

    _treeKeyCache.clear();
    _session = { seed, rootPublicKey, identityHash, accounts, activeIndex: accounts[0].index };
  },

  lock(): void {
    if (_session) { _session.seed.fill(0); _session = null; }
    _treeKeyCache.clear();
    _pendingMnemonic = null;
  },

  isUnlocked(): boolean { return _session !== null; },
  getSession():  SessionState | null { return _session; },

  getActiveAccount(): AccountRecord | null {
    if (!_session) return null;
    return _session.accounts.find(a => a.index === _session!.activeIndex) ?? null;
  },

  setActiveAccount(index: number): void {
    if (!_session) throw new Error('Wallet locked');
    if (!_session.accounts.find(a => a.index === index)) throw new Error('Account not found');
    _session.activeIndex = index;
  },

  /**
   * Derive next address using the Web Worker (keeps UI thread free).
   * The TreeKey for this new address is NOT cached here — it is derived
   * on-demand via getActiveTreeKey() when signing is needed.
   */
  async addNextAddress(): Promise<AccountRecord> {
    if (!_session) throw new Error('Wallet locked');
    const nextIndex = await VaultStore.nextAccountIndex();

    const { address, publicKey } = await deriveAddressViaWorker(_session.seed, nextIndex);
    const account: AccountRecord = { index: nextIndex, address, publicKey, name: `Account ${nextIndex + 1}` };

    await VaultStore.addAccount(account);
    _session.accounts = [..._session.accounts, account];
    return account;
  },

  /**
   * Get (or derive) the TreeKey for the active account.
   * Result is cached in _treeKeyCache for the session lifetime.
   * Restores persisted parent-child sig cache so repeat signing is fast.
   * Caller must sync the server watermark BEFORE calling .sign() on the returned key.
   */
  async getActiveTreeKey(): Promise<TreeKey> {
    if (!_session) throw new Error('Wallet locked');
    const idx = _session.activeIndex;
    if (_treeKeyCache.has(idx)) return _treeKeyCache.get(idx)!;
    const treeKey = await createUnifiedChildTreeKeyAsync(_session.seed, idx);
    // Restore persisted parent→child sig proofs so fast-path signing is available
    try {
      const stored = await SigCacheStore.getCacheForWallet(_session.rootPublicKey);
      if (stored && Array.isArray(stored) && stored.length > 0) {
        treeKey.restoreCachedSignatures(new Map(stored as Array<[string, SignatureProof]>));
      }
    } catch { /* non-fatal — worst case: recomputes proofs from scratch */ }
    _treeKeyCache.set(idx, treeKey);
    return treeKey;
  },

  /**
   * Persist parent-child sig proofs from all cached TreeKeys to IndexedDB so
   * subsequent signs skip the expensive parent-node computation.
   */
  async flushSigCache(): Promise<void> {
    if (!_session) return;
    for (const treeKey of _treeKeyCache.values()) {
      const cache = treeKey.getCachedSignatures();
      if (cache.size > 0) {
        await SigCacheStore.saveCacheForWallet(
          _session.rootPublicKey,
          [...cache.entries()],
        );
      }
    }
  },

  async getSigCache(): Promise<unknown | null> {
    if (!_session) return null;
    return SigCacheStore.getCacheForWallet(_session.rootPublicKey);
  },

  async saveSigCache(data: unknown): Promise<void> {
    if (!_session) return;
    await SigCacheStore.saveCacheForWallet(_session.rootPublicKey, data);
  },

  async isBackupConfirmed(): Promise<boolean> { return VaultStore.isBackupConfirmed(); },

  async confirmBackup(): Promise<void> {
    await VaultStore.setBackupConfirmed();
    _pendingMnemonic = null;
  },

  async hasWallet(): Promise<boolean> { return VaultStore.hasWallet(); },

  // ── Periodic watermark sync ────────────────────────────────────────────

  _watermarkInterval: ReturnType<typeof setInterval> | null = null,

  startWatermarkSync(intervalMs = 60000): void {
    this.stopWatermarkSync();
    this._watermarkInterval = setInterval(async () => {
      if (!_session) return;
      try {
        await fetchWatermark(_session.rootPublicKey, _session.identityHash);
      } catch { /* non-fatal — will retry next interval */ }
    }, intervalMs);
  },

  stopWatermarkSync(): void {
    if (this._watermarkInterval) {
      clearInterval(this._watermarkInterval);
      this._watermarkInterval = null;
    }
  },

  async resetWallet(): Promise<void> {
    WalletManager.lock();
    await VaultStore.clearAll();
    await SigCacheStore.clearAll();
    if (_keyWorker) { _keyWorker.terminate(); _keyWorker = null; _workerReady = false; }
  },
};
