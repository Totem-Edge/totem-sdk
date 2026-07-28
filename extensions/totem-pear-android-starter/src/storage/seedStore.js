/**
 * seedStore.js — encrypted seed persistence via BareKVStore (Hyperbee-backed).
 *
 * The seed is stored as a hex string under the key 'wallet:seed'.
 * For production use, encrypt the seed bytes with a PIN-derived key from
 * @noble/hashes (e.g. PBKDF2-SHA3) before calling save(), and decrypt on load().
 *
 * See: https://github.com/paulmillr/noble-hashes for browser/Bare-compatible crypto.
 */

import { BareKVStore } from '@totemsdk/pear/storage';

const SEED_KEY = 'wallet:seed';

export class SeedStore {
  constructor(storagePath = './data/kv') {
    this._store = new BareKVStore({ storagePath });
  }

  async save(seedBytes) {
    const hex = Buffer.from(seedBytes).toString('hex');
    await this._store.set(SEED_KEY, hex);
  }

  async load() {
    const hex = await this._store.get(SEED_KEY);
    if (!hex) return null;
    return Buffer.from(hex, 'hex');
  }

  async has() {
    return this._store.has(SEED_KEY);
  }

  async close() {
    await this._store.close();
  }
}
