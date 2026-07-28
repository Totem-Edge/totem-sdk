/**
 * VaultStore — AES-256-GCM encrypted seed storage in IndexedDB
 *
 * Schema
 * ------
 * DB: totem-pwa-wallet  version: 1
 *   store "vault":    { id: 'seed', encryptedSeed, salt, iv, backupConfirmed }
 *   store "accounts": { index (key), address, publicKey, name }
 */
import { openDB, type IDBPDatabase } from 'idb';

export interface VaultRecord {
  id: string;
  encryptedSeed: ArrayBuffer;
  salt: ArrayBuffer;
  iv: ArrayBuffer;
  backupConfirmed: boolean;
  /** AES-GCM encrypted UTF-8 mnemonic phrase (added in v1.1) */
  encryptedMnemonic?: ArrayBuffer;
  /** IV for the encrypted mnemonic (separate from seed IV) */
  mnemonicIv?: ArrayBuffer;
}

export interface AccountRecord {
  index: number;
  address: string;
  publicKey: string;
  name: string;
}

const DB_NAME = 'totem-pwa-wallet';
const DB_VERSION = 1;

let _db: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('vault')) {
        db.createObjectStore('vault', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('accounts')) {
        db.createObjectStore('accounts', { keyPath: 'index' });
      }
    },
  });
  return _db;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function toArrayBuffer(u8: Uint8Array): Uint8Array<ArrayBuffer> {
  if (u8.buffer instanceof ArrayBuffer) return u8 as Uint8Array<ArrayBuffer>;
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy as Uint8Array<ArrayBuffer>;
}

export const VaultStore = {
  async hasWallet(): Promise<boolean> {
    const db = await getDb();
    const rec = await db.get('vault', 'seed');
    return !!rec;
  },

  /**
   * Save seed only (legacy path — does not store mnemonic, revealMnemonic will fail).
   * Prefer saveWallet() for new wallets.
   */
  async saveSeed(seed: Uint8Array, password: string): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(32)) as Uint8Array<ArrayBuffer>;
    const iv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>;
    const key = await deriveKey(password, salt);
    const encryptedSeed = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      toArrayBuffer(seed)
    );
    const db = await getDb();
    await db.put('vault', {
      id: 'seed',
      encryptedSeed,
      salt: salt.buffer,
      iv: iv.buffer,
      backupConfirmed: false,
    } satisfies VaultRecord);
  },

  /**
   * Save both seed AND mnemonic phrase encrypted under the same password.
   * The mnemonic is stored with a separate IV so it can be decrypted independently.
   * Use this for all new wallet creation/import so revealMnemonic() works later.
   */
  async saveWallet(mnemonic: string, seed: Uint8Array, password: string): Promise<void> {
    const salt       = crypto.getRandomValues(new Uint8Array(32)) as Uint8Array<ArrayBuffer>;
    const iv         = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>;
    const mnemonicIv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>;
    const key = await deriveKey(password, salt);
    const [encryptedSeed, encryptedMnemonic] = await Promise.all([
      crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, toArrayBuffer(seed)),
      crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: mnemonicIv },
        key,
        new TextEncoder().encode(mnemonic),
      ),
    ]);
    const db = await getDb();
    await db.put('vault', {
      id: 'seed',
      encryptedSeed,
      salt: salt.buffer,
      iv: iv.buffer,
      backupConfirmed: false,
      encryptedMnemonic,
      mnemonicIv: mnemonicIv.buffer,
    } satisfies VaultRecord);
  },

  /**
   * Decrypt and return the stored mnemonic phrase.
   * Requires the wallet password.  Throws if no mnemonic is stored (wallets
   * created before v1.1 used saveSeed() and cannot show the phrase).
   */
  async loadMnemonic(password: string): Promise<string> {
    const db = await getDb();
    const rec: VaultRecord | undefined = await db.get('vault', 'seed');
    if (!rec) throw new Error('No wallet found');
    if (!rec.encryptedMnemonic || !rec.mnemonicIv) {
      throw new Error('Seed phrase not available — wallet was created before phrase backup was supported. Restore from your original backup.');
    }
    const saltBuf = new Uint8Array(rec.salt) as Uint8Array<ArrayBuffer>;
    const ivBuf   = new Uint8Array(rec.mnemonicIv) as Uint8Array<ArrayBuffer>;
    const key = await deriveKey(password, saltBuf);
    try {
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuf },
        key,
        rec.encryptedMnemonic,
      );
      return new TextDecoder().decode(plaintext);
    } catch {
      throw new Error('Wrong password');
    }
  },

  async loadSeed(password: string): Promise<Uint8Array> {
    const db = await getDb();
    const rec: VaultRecord | undefined = await db.get('vault', 'seed');
    if (!rec) throw new Error('No wallet found');
    const saltBuf = new Uint8Array(rec.salt) as Uint8Array<ArrayBuffer>;
    const ivBuf = new Uint8Array(rec.iv) as Uint8Array<ArrayBuffer>;
    const key = await deriveKey(password, saltBuf);
    try {
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuf },
        key,
        rec.encryptedSeed
      );
      return new Uint8Array(plaintext);
    } catch {
      throw new Error('Wrong password');
    }
  },

  async isBackupConfirmed(): Promise<boolean> {
    const db = await getDb();
    const rec: VaultRecord | undefined = await db.get('vault', 'seed');
    return rec?.backupConfirmed ?? false;
  },

  async setBackupConfirmed(): Promise<void> {
    const db = await getDb();
    const rec: VaultRecord | undefined = await db.get('vault', 'seed');
    if (!rec) return;
    await db.put('vault', { ...rec, backupConfirmed: true });
  },

  async addAccount(account: AccountRecord): Promise<void> {
    const db = await getDb();
    await db.put('accounts', account);
  },

  async getAccounts(): Promise<AccountRecord[]> {
    const db = await getDb();
    return db.getAll('accounts');
  },

  async getAccount(index: number): Promise<AccountRecord | undefined> {
    const db = await getDb();
    return db.get('accounts', index);
  },

  async nextAccountIndex(): Promise<number> {
    const accounts = await VaultStore.getAccounts();
    return accounts.length === 0 ? 0 : Math.max(...accounts.map(a => a.index)) + 1;
  },

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.clear('vault');
    await db.clear('accounts');
  },
};
