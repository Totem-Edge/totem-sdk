/**
 * Multisig Manager Service
 * 
 * Handles multisig transaction workflows including:
 * - Creating multisig scripts (2-of-2, M-of-N)
 * - Managing partial signatures
 * - Importing/exporting transactions for signature collection
 * - Validating signature completeness
 * 
 * Totem signs as a single entity - this service manages coordination
 * with external signers.
 */

import { sha3_256 } from 'js-sha3';
import type {
  ScriptDescriptor,
  ExternalSignature,
  MMRProof
} from '../types/ScriptTypes';
import {
  createMultisigDescriptor,
  createMofNMultisigDescriptor
} from '../types/ScriptTypes';

const PENDING_MULTISIG_KEY = 'totem_pending_multisig';

export interface MultisigConfig {
  type: '2of2' | 'mofn';
  threshold: number;
  publicKeys: string[];
  ownPublicKey: string;
  address?: string;
}

export interface PendingMultisigTransaction {
  id: string;
  config: MultisigConfig;
  transactionHex: string;
  transactionDigest: string;
  signatures: Map<string, ExternalSignature>;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'ready' | 'broadcast' | 'expired' | 'failed';
}

export interface MultisigExportData {
  version: number;
  id: string;
  config: MultisigConfig;
  transactionHex: string;
  transactionDigest: string;
  signatures: Array<{
    publicKey: string;
    signature: string;
    signatureType: 'wots' | 'standard';
  }>;
  createdAt: number;
}

/**
 * MultisigManager handles the lifecycle of multisig transactions.
 */
export class MultisigManager {
  private pendingTransactions: Map<string, PendingMultisigTransaction> = new Map();
  readonly ready: Promise<void>;
  
  constructor() {
    this.ready = this.load();
  }
  
  private async load(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(PENDING_MULTISIG_KEY);
        const data = result[PENDING_MULTISIG_KEY];
        if (data) {
          for (const tx of data.transactions || []) {
            tx.signatures = new Map(Object.entries(tx.signatures || {}));
            this.pendingTransactions.set(tx.id, tx);
          }
        }
      }
    } catch (err) {
      console.error('[MultisigManager] Failed to load:', err);
    }
  }
  
  private async save(): Promise<void> {
    try {
      const transactions = Array.from(this.pendingTransactions.values()).map(tx => ({
        ...tx,
        signatures: Object.fromEntries(tx.signatures)
      }));
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [PENDING_MULTISIG_KEY]: { transactions } });
      }
    } catch (err) {
      console.error('[MultisigManager] Failed to save:', err);
    }
  }
  
  /**
   * Create a multisig script descriptor.
   */
  createMultisigScript(config: MultisigConfig): ScriptDescriptor {
    if (config.type === '2of2') {
      if (config.publicKeys.length !== 2) {
        throw new Error('2-of-2 multisig requires exactly 2 public keys');
      }
      return createMultisigDescriptor(
        config.address || '',
        config.publicKeys[0],
        config.publicKeys[1],
        config.ownPublicKey
      );
    } else {
      return createMofNMultisigDescriptor(
        config.address || '',
        config.threshold,
        config.publicKeys,
        config.ownPublicKey
      );
    }
  }
  
  /**
   * Compute script address from multisig config.
   */
  computeMultisigAddress(config: MultisigConfig): string {
    const descriptor = this.createMultisigScript(config);
    const scriptBytes = new TextEncoder().encode(descriptor.script.trim().toUpperCase());
    const hashBytes = new Uint8Array(sha3_256.arrayBuffer(scriptBytes));
    return '0x' + Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * Start a new multisig transaction.
   */
  async createPendingTransaction(
    config: MultisigConfig,
    transactionHex: string,
    transactionDigest: string,
    expirationHours: number = 24
  ): Promise<PendingMultisigTransaction> {
    await this.ready;
    const id = generateTransactionId();
    
    const tx: PendingMultisigTransaction = {
      id,
      config,
      transactionHex,
      transactionDigest,
      signatures: new Map(),
      createdAt: Date.now(),
      expiresAt: Date.now() + (expirationHours * 60 * 60 * 1000),
      status: 'pending'
    };
    
    this.pendingTransactions.set(id, tx);
    await this.save();
    
    return tx;
  }
  
  /**
   * Add Totem's signature to a pending transaction.
   */
  async addOwnSignature(
    transactionId: string,
    signature: string,
    proof?: MMRProof
  ): Promise<void> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (!tx) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    if (tx.status === 'expired' || tx.status === 'failed') {
      throw new Error(`Transaction ${transactionId} is ${tx.status}`);
    }
    
    const extSig: ExternalSignature = {
      publicKey: tx.config.ownPublicKey,
      signature,
      proof,
      signatureType: 'wots',
      validated: true
    };
    
    tx.signatures.set(tx.config.ownPublicKey.toLowerCase(), extSig);
    this.updateStatus(tx);
    await this.save();
  }
  
  /**
   * Import an external signature.
   */
  async importExternalSignature(
    transactionId: string,
    publicKey: string,
    signature: string,
    signatureType: 'wots' | 'standard' = 'wots',
    proof?: MMRProof
  ): Promise<{ valid: boolean; error?: string }> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (!tx) {
      return { valid: false, error: `Transaction ${transactionId} not found` };
    }
    
    if (tx.status === 'expired' || tx.status === 'failed') {
      return { valid: false, error: `Transaction ${transactionId} is ${tx.status}` };
    }
    
    const normalizedKey = publicKey.toLowerCase();
    const isValidSigner = tx.config.publicKeys.some(
      pk => pk.toLowerCase() === normalizedKey
    );
    
    if (!isValidSigner) {
      return { valid: false, error: 'Public key is not a valid signer for this transaction' };
    }
    
    const extSig: ExternalSignature = {
      publicKey,
      signature,
      proof,
      signatureType,
      validated: true
    };
    
    tx.signatures.set(normalizedKey, extSig);
    this.updateStatus(tx);
    await this.save();
    
    return { valid: true };
  }
  
  /**
   * Update transaction status based on signature count.
   */
  private updateStatus(tx: PendingMultisigTransaction): void {
    if (Date.now() > tx.expiresAt) {
      tx.status = 'expired';
      return;
    }
    
    const signatureCount = tx.signatures.size;
    const requiredCount = tx.config.threshold;
    
    if (signatureCount >= requiredCount) {
      tx.status = 'ready';
    } else {
      tx.status = 'pending';
    }
  }
  
  /**
   * Get all signatures for a transaction.
   */
  async getSignatures(transactionId: string): Promise<ExternalSignature[]> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (!tx) {
      return [];
    }
    return Array.from(tx.signatures.values());
  }
  
  async isReady(transactionId: string): Promise<boolean> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (!tx) return false;
    
    this.updateStatus(tx);
    return tx.status === 'ready';
  }
  
  async getSignatureStatus(transactionId: string): Promise<{
    required: number;
    collected: number;
    missing: string[];
    status: string;
  }> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (!tx) {
      return { required: 0, collected: 0, missing: [], status: 'not_found' };
    }
    
    this.updateStatus(tx);
    
    const collected = tx.signatures.size;
    const required = tx.config.threshold;
    const missing: string[] = [];
    
    for (const pk of tx.config.publicKeys) {
      if (!tx.signatures.has(pk.toLowerCase())) {
        missing.push(pk);
      }
    }
    
    return {
      required,
      collected,
      missing,
      status: tx.status
    };
  }
  
  /**
   * Export transaction for sharing with other signers.
   */
  async exportTransaction(transactionId: string): Promise<MultisigExportData> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (!tx) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    return {
      version: 1,
      id: tx.id,
      config: tx.config,
      transactionHex: tx.transactionHex,
      transactionDigest: tx.transactionDigest,
      signatures: Array.from(tx.signatures.values()).map(sig => ({
        publicKey: sig.publicKey,
        signature: sig.signature,
        signatureType: sig.signatureType
      })),
      createdAt: tx.createdAt
    };
  }
  
  async importTransaction(data: MultisigExportData): Promise<PendingMultisigTransaction> {
    await this.ready;
    const existing = this.pendingTransactions.get(data.id);
    if (existing) {
      for (const sig of data.signatures) {
        if (!existing.signatures.has(sig.publicKey.toLowerCase())) {
          await this.importExternalSignature(
            data.id,
            sig.publicKey,
            sig.signature,
            sig.signatureType
          );
        }
      }
      return existing;
    }
    
    const tx: PendingMultisigTransaction = {
      id: data.id,
      config: data.config,
      transactionHex: data.transactionHex,
      transactionDigest: data.transactionDigest,
      signatures: new Map(),
      createdAt: data.createdAt,
      expiresAt: data.createdAt + (24 * 60 * 60 * 1000),
      status: 'pending'
    };
    
    for (const sig of data.signatures) {
      tx.signatures.set(sig.publicKey.toLowerCase(), {
        publicKey: sig.publicKey,
        signature: sig.signature,
        signatureType: sig.signatureType,
        validated: true
      });
    }
    
    this.updateStatus(tx);
    this.pendingTransactions.set(data.id, tx);
    await this.save();
    
    return tx;
  }
  
  /**
   * Mark transaction as broadcast.
   */
  async markBroadcast(transactionId: string): Promise<void> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (tx) {
      tx.status = 'broadcast';
      await this.save();
    }
  }
  
  async markFailed(transactionId: string, error?: string): Promise<void> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (tx) {
      tx.status = 'failed';
      await this.save();
    }
  }
  
  async getTransaction(transactionId: string): Promise<PendingMultisigTransaction | undefined> {
    await this.ready;
    return this.pendingTransactions.get(transactionId);
  }
  
  async getAllPending(): Promise<PendingMultisigTransaction[]> {
    await this.ready;
    const now = Date.now();
    const result: PendingMultisigTransaction[] = [];
    
    for (const tx of this.pendingTransactions.values()) {
      if (tx.expiresAt < now) {
        tx.status = 'expired';
      }
      if (tx.status === 'pending' || tx.status === 'ready') {
        result.push(tx);
      }
    }
    
    return result;
  }
  
  async cleanupExpired(): Promise<number> {
    await this.ready;
    const now = Date.now();
    let removed = 0;
    
    for (const [id, tx] of this.pendingTransactions) {
      if (tx.expiresAt < now || tx.status === 'broadcast' || tx.status === 'failed') {
        this.pendingTransactions.delete(id);
        removed++;
      }
    }
    
    if (removed > 0) {
      await this.save();
    }
    
    return removed;
  }
  
  async deleteTransaction(transactionId: string): Promise<boolean> {
    await this.ready;
    const deleted = this.pendingTransactions.delete(transactionId);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }
}

function generateTransactionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

let managerInstance: MultisigManager | null = null;

export function getMultisigManager(): MultisigManager {
  if (!managerInstance) {
    managerInstance = new MultisigManager();
  }
  return managerInstance;
}
