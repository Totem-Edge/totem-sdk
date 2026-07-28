/**
 * Parent-Child Signature Cache Store
 * 
 * Persists TreeKey parent-child signatures between wallet sessions.
 * 
 * In Minima's TreeKey architecture:
 * - Level-0 keys sign Level-1 node roots (cached)
 * - Level-1 keys sign Level-2 node roots (cached)
 * - Level-2 keys sign actual transaction data (never cached)
 * 
 * Caching parent-child signatures:
 * 1. Improves performance (no need to re-sign child roots)
 * 2. Ensures consistency (same signature for same path)
 * 3. Matches Java TreeKey.setParentChildSig() behavior
 * 
 * Storage format:
 * - Key: wallet root public key (hex)
 * - Value: Map<pathKey, SignatureProofHex>
 *   - pathKey: "l1" or "l1,l2" format
 *   - SignatureProofHex: { leafPubkey, signature, mmrProof } as hex strings
 */

import type { SignatureProof } from '@totemsdk/core';
import { serializeMMRProof, deserializeMMRProof } from '@totemsdk/core';

const STORAGE_KEY = 'totem_parent_child_sig_cache';

interface SignatureProofHex {
  leafPubkey: string;
  signature: string;
  mmrProof: string;
}

interface CacheEntry {
  rootPubkey: string;
  cache: Record<string, SignatureProofHex>;
  updatedAt: number;
}

function toHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

export class ParentChildSigCacheStore {
  private entries: Map<string, CacheEntry> = new Map();
  private loaded = false;
  
  async load(): Promise<void> {
    if (this.loaded) return;
    
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        const entriesArray: CacheEntry[] = result[STORAGE_KEY];
        this.entries = new Map(entriesArray.map(e => [e.rootPubkey, e]));
        console.log(`[ParentChildSigCache] Loaded ${this.entries.size} wallet caches`);
      }
      this.loaded = true;
    } catch (error) {
      console.error('[ParentChildSigCache] Failed to load:', error);
      this.loaded = true;
    }
  }
  
  private async persist(): Promise<void> {
    try {
      const entriesArray = Array.from(this.entries.values());
      await chrome.storage.local.set({ [STORAGE_KEY]: entriesArray });
    } catch (error) {
      console.error('[ParentChildSigCache] Failed to persist:', error);
    }
  }
  
  /**
   * Get the cached signatures for a wallet as a Map
   * Returns format compatible with TreeKey.restoreCachedSignatures()
   */
  async getCacheForWallet(rootPubkey: string): Promise<Map<string, SignatureProof>> {
    await this.load();
    
    const entry = this.entries.get(rootPubkey);
    if (!entry) {
      console.log(`[ParentChildSigCache] No cache for wallet ${rootPubkey.substring(0, 16)}...`);
      return new Map();
    }
    
    const cache = new Map<string, SignatureProof>();
    for (const [pathKey, proofHex] of Object.entries(entry.cache)) {
      try {
        const leafPubkey = fromHex(proofHex.leafPubkey);
        const signature = fromHex(proofHex.signature);
        const { proof: mmrProof } = deserializeMMRProof(fromHex(proofHex.mmrProof));
        
        cache.set(pathKey, { leafPubkey, signature, mmrProof });
      } catch (e) {
        console.warn(`[ParentChildSigCache] Failed to deserialize proof for path ${pathKey}:`, e);
      }
    }
    
    console.log(`[ParentChildSigCache] Restored ${cache.size} cached signatures for wallet ${rootPubkey.substring(0, 16)}...`);
    return cache;
  }
  
  /**
   * Save the cache for a wallet from TreeKey.getCachedSignatures()
   */
  async saveCacheForWallet(rootPubkey: string, cache: Map<string, SignatureProof>): Promise<void> {
    await this.load();
    
    const cacheObj: Record<string, SignatureProofHex> = {};
    for (const [pathKey, proof] of cache.entries()) {
      cacheObj[pathKey] = {
        leafPubkey: toHex(proof.leafPubkey),
        signature: toHex(proof.signature),
        mmrProof: toHex(serializeMMRProof(proof.mmrProof))
      };
    }
    
    this.entries.set(rootPubkey, {
      rootPubkey,
      cache: cacheObj,
      updatedAt: Date.now()
    });
    
    await this.persist();
    console.log(`[ParentChildSigCache] Saved ${cache.size} cached signatures for wallet ${rootPubkey.substring(0, 16)}...`);
  }
  
  /**
   * Clear cache for a specific wallet
   */
  async clearCacheForWallet(rootPubkey: string): Promise<void> {
    await this.load();
    this.entries.delete(rootPubkey);
    await this.persist();
    console.log(`[ParentChildSigCache] Cleared cache for wallet ${rootPubkey.substring(0, 16)}...`);
  }
  
  /**
   * Get cache stats for debugging
   */
  async getStats(): Promise<{ walletCount: number; totalSignatures: number }> {
    await this.load();
    let totalSignatures = 0;
    for (const entry of this.entries.values()) {
      totalSignatures += Object.keys(entry.cache).length;
    }
    return { walletCount: this.entries.size, totalSignatures };
  }
}

export const parentChildSigCache = new ParentChildSigCacheStore();
