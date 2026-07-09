/**
 * Script Catalog Service
 * 
 * Manages a local cache of known scripts and their addresses.
 * This enables quick ScriptProof lookup when building transactions
 * without needing to re-derive scripts each time.
 * 
 * The catalog stores:
 * - User's HD wallet scripts (all 64 addresses)
 * - Custom scripts the user has created or interacted with
 * - Imported scripts from external sources (multisig partners, etc.)
 */

import { sha3_256 } from 'js-sha3';
import type { 
  ScriptDescriptor, 
  ScriptType, 
  ScriptCatalogEntry 
} from '../types/ScriptTypes';

const CATALOG_STORAGE_KEY = 'totem_script_catalog';
const CATALOG_VERSION = 1;

interface StoredCatalog {
  version: number;
  entries: Record<string, ScriptCatalogEntry>;
  lastUpdated: number;
}

/**
 * ScriptCatalog provides persistent storage and lookup for known scripts.
 */
export class ScriptCatalog {
  private entries: Map<string, ScriptCatalogEntry> = new Map();
  private initialized: boolean = false;
  
  constructor() {
    this.load();
  }
  
  /**
   * Load catalog from persistent storage.
   */
  private load(): void {
    try {
      const stored = localStorage.getItem(CATALOG_STORAGE_KEY);
      if (stored) {
        const catalog: StoredCatalog = JSON.parse(stored);
        if (catalog.version === CATALOG_VERSION) {
          this.entries = new Map(Object.entries(catalog.entries));
        }
      }
      this.initialized = true;
    } catch (err) {
      console.error('[ScriptCatalog] Failed to load from storage:', err);
      this.entries = new Map();
      this.initialized = true;
    }
  }
  
  /**
   * Save catalog to persistent storage.
   */
  private save(): void {
    try {
      const catalog: StoredCatalog = {
        version: CATALOG_VERSION,
        entries: Object.fromEntries(this.entries),
        lastUpdated: Date.now()
      };
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
    } catch (err) {
      console.error('[ScriptCatalog] Failed to save to storage:', err);
    }
  }
  
  /**
   * Compute script address from script text.
   */
  static computeAddress(script: string): string {
    const cleanScript = script.trim().toUpperCase();
    const scriptBytes = new TextEncoder().encode(cleanScript);
    const hashBytes = new Uint8Array(sha3_256.arrayBuffer(scriptBytes));
    return '0x' + Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * Add a script to the catalog.
   */
  add(script: string, scriptType: ScriptType): ScriptCatalogEntry {
    const address = ScriptCatalog.computeAddress(script);
    const normalizedAddr = address.toLowerCase();
    
    const existing = this.entries.get(normalizedAddr);
    if (existing) {
      existing.lastUsed = Date.now();
      this.save();
      return existing;
    }
    
    const entry: ScriptCatalogEntry = {
      address,
      script,
      scriptType,
      createdAt: Date.now(),
      lastUsed: Date.now()
    };
    
    this.entries.set(normalizedAddr, entry);
    this.save();
    
    return entry;
  }
  
  /**
   * Add a script with a known address (for imported scripts).
   */
  addWithAddress(address: string, script: string, scriptType: ScriptType): ScriptCatalogEntry {
    const normalizedAddr = address.toLowerCase();
    
    const existing = this.entries.get(normalizedAddr);
    if (existing) {
      existing.lastUsed = Date.now();
      this.save();
      return existing;
    }
    
    const entry: ScriptCatalogEntry = {
      address,
      script,
      scriptType,
      createdAt: Date.now(),
      lastUsed: Date.now()
    };
    
    this.entries.set(normalizedAddr, entry);
    this.save();
    
    return entry;
  }
  
  /**
   * Look up a script by address.
   */
  get(address: string): ScriptCatalogEntry | undefined {
    const normalizedAddr = address.toLowerCase();
    const entry = this.entries.get(normalizedAddr);
    
    if (entry) {
      entry.lastUsed = Date.now();
      this.save();
    }
    
    return entry;
  }
  
  /**
   * Check if an address has a known script.
   */
  has(address: string): boolean {
    return this.entries.has(address.toLowerCase());
  }
  
  /**
   * Remove a script from the catalog.
   */
  remove(address: string): boolean {
    const normalizedAddr = address.toLowerCase();
    const removed = this.entries.delete(normalizedAddr);
    if (removed) {
      this.save();
    }
    return removed;
  }
  
  /**
   * Get all scripts of a specific type.
   */
  getByType(scriptType: ScriptType): ScriptCatalogEntry[] {
    const results: ScriptCatalogEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.scriptType === scriptType) {
        results.push(entry);
      }
    }
    return results;
  }
  
  /**
   * Get all catalog entries.
   */
  getAll(): ScriptCatalogEntry[] {
    return Array.from(this.entries.values());
  }
  
  /**
   * Clear the entire catalog.
   */
  clear(): void {
    this.entries.clear();
    this.save();
  }
  
  /**
   * Import scripts from wallet initialization.
   * 
   * For HD wallets, all 64 addresses share the same WOTS root public key,
   * so we add one script that applies to all addresses.
   */
  importWalletScripts(wotsRootPublicKey: string, addresses: string[]): void {
    const pubKeyWithPrefix = wotsRootPublicKey.startsWith('0x')
      ? wotsRootPublicKey.toUpperCase().replace('0X', '0x')
      : '0x' + wotsRootPublicKey.toUpperCase();
    
    const script = `RETURN SIGNEDBY(${pubKeyWithPrefix})`;
    
    for (const address of addresses) {
      this.addWithAddress(address, script, 'signedby');
    }
    
    console.log(`[ScriptCatalog] Imported ${addresses.length} wallet addresses`);
  }
  
  /**
   * Build ScriptDescriptor from catalog entry.
   */
  toDescriptor(address: string, wotsRootPublicKey?: string): ScriptDescriptor | undefined {
    const entry = this.get(address);
    if (!entry) {
      return undefined;
    }
    
    return {
      address: entry.address,
      scriptType: entry.scriptType,
      script: entry.script,
      wotsRootPublicKey,
      mastProof: { chunks: [] },
      storeState: false
    };
  }
  
  /**
   * Get catalog size.
   */
  get size(): number {
    return this.entries.size;
  }
}

let catalogInstance: ScriptCatalog | null = null;

export function getScriptCatalog(): ScriptCatalog {
  if (!catalogInstance) {
    catalogInstance = new ScriptCatalog();
  }
  return catalogInstance;
}

export function resetScriptCatalog(): void {
  catalogInstance = null;
}
