import type { SigningIndices, WotsIndices } from './WatermarkStore';

export type TransactionLifecycle = 
  | 'created'      // Transaction created but not yet submitted
  | 'signing'      // WOTS signing in progress
  | 'submitted'    // Submitted to network, waiting for mining
  | 'pending'      // In mempool, waiting for confirmation
  | 'confirmed'    // Confirmed on chain
  | 'failed';      // Failed at any stage

export interface TransactionReceipt {
  txpowid: string;
  timestamp: number;
  to: string;
  amount: string;
  tokenId: string;
  indices: SigningIndices | WotsIndices;  // Support both formats for backward compatibility
  status: 'confirmed' | 'pending' | 'failed'; // Legacy status field
  txId?: string;
  leaseId?: string;
  
  // Extended fields for MetaMask-style UX
  lifecycle?: TransactionLifecycle;
  tokenSymbol?: string;
  tokenName?: string;
  from?: string;
  explorerUrl?: string;
  blockHeight?: number;
  confirmations?: number;
  fee?: string;
  memo?: string;
  failureReason?: string;
  failureStage?: string;
  updatedAt?: number;
}

const STORAGE_KEY = 'totem_transaction_receipts';
const MAX_RECEIPTS = 1000;

// Minima explorer base URL
const EXPLORER_BASE_URL = 'https://explorer.minima.global';

export class TransactionReceiptStore {
  private receipts: TransactionReceipt[] = [];
  private initialized = false;

  async load(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        this.receipts = result[STORAGE_KEY];
      }
      this.initialized = true;
    } catch (error) {
      console.error('[TransactionReceiptStore] Failed to load receipts:', error);
    }
  }

  private async persist(): Promise<void> {
    try {
      const trimmedReceipts = this.receipts.slice(-MAX_RECEIPTS);
      await chrome.storage.local.set({
        [STORAGE_KEY]: trimmedReceipts
      });
      this.receipts = trimmedReceipts;
    } catch (error) {
      console.error('[TransactionReceiptStore] Failed to persist receipts:', error);
      throw error;
    }
  }

  async add(receipt: TransactionReceipt): Promise<void> {
    // Set defaults for new fields
    const enrichedReceipt: TransactionReceipt = {
      ...receipt,
      lifecycle: receipt.lifecycle || this.statusToLifecycle(receipt.status),
      explorerUrl: receipt.explorerUrl || this.buildExplorerUrl(receipt.txpowid),
      updatedAt: Date.now()
    };
    
    this.receipts.push(enrichedReceipt);
    await this.persist();
  }

  /**
   * Create a pending receipt stub when transaction is initiated
   */
  async createPending(params: {
    to: string;
    amount: string;
    tokenId: string;
    tokenSymbol?: string;
    from?: string;
    indices: SigningIndices | WotsIndices;
    leaseId?: string;
  }): Promise<string> {
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    const receipt: TransactionReceipt = {
      txpowid: tempId,
      timestamp: Date.now(),
      to: params.to,
      amount: params.amount,
      tokenId: params.tokenId,
      tokenSymbol: params.tokenSymbol,
      from: params.from,
      indices: params.indices,
      leaseId: params.leaseId,
      status: 'pending',
      lifecycle: 'signing',
      updatedAt: Date.now()
    };
    
    this.receipts.push(receipt);
    await this.persist();
    
    return tempId;
  }

  /**
   * Update a pending receipt with the actual txpowid after submission
   */
  async confirmSubmission(tempId: string, txpowid: string, leaseId?: string): Promise<void> {
    const receipt = this.receipts.find(r => r.txpowid === tempId);
    if (receipt) {
      receipt.txpowid = txpowid;
      receipt.leaseId = leaseId;
      receipt.lifecycle = 'submitted';
      receipt.explorerUrl = this.buildExplorerUrl(txpowid);
      receipt.updatedAt = Date.now();
      await this.persist();
    }
  }

  getAll(): TransactionReceipt[] {
    return [...this.receipts].reverse();
  }

  getByTxpowid(txpowid: string): TransactionReceipt | undefined {
    return this.receipts.find(r => r.txpowid === txpowid);
  }

  getRecent(count: number = 50): TransactionReceipt[] {
    return this.getAll().slice(0, count);
  }

  getPending(): TransactionReceipt[] {
    return this.receipts.filter(r => 
      r.lifecycle === 'signing' || 
      r.lifecycle === 'submitted' || 
      r.lifecycle === 'pending' ||
      r.status === 'pending'
    );
  }

  async updateStatus(txpowid: string, status: TransactionReceipt['status']): Promise<void> {
    const receipt = this.receipts.find(r => r.txpowid === txpowid);
    if (receipt) {
      receipt.status = status;
      receipt.lifecycle = this.statusToLifecycle(status);
      receipt.updatedAt = Date.now();
      await this.persist();
    }
  }

  async updateLifecycle(txpowid: string, lifecycle: TransactionLifecycle, extra?: Partial<TransactionReceipt>): Promise<void> {
    const receipt = this.receipts.find(r => r.txpowid === txpowid);
    if (receipt) {
      receipt.lifecycle = lifecycle;
      receipt.status = this.lifecycleToStatus(lifecycle);
      receipt.updatedAt = Date.now();
      
      if (extra) {
        Object.assign(receipt, extra);
      }
      
      await this.persist();
    }
  }

  async markConfirmed(txpowid: string, blockHeight?: number, confirmations?: number): Promise<void> {
    await this.updateLifecycle(txpowid, 'confirmed', {
      blockHeight,
      confirmations
    });
  }

  async markFailed(txpowid: string, reason: string, stage?: string): Promise<void> {
    await this.updateLifecycle(txpowid, 'failed', {
      failureReason: reason,
      failureStage: stage
    });
  }

  async clear(): Promise<void> {
    this.receipts = [];
    await chrome.storage.local.remove(STORAGE_KEY);
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.load();
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private buildExplorerUrl(txpowid: string): string {
    if (!txpowid || txpowid.startsWith('pending-')) {
      return '';
    }
    return `${EXPLORER_BASE_URL}/tx/${txpowid}`;
  }

  private statusToLifecycle(status: TransactionReceipt['status']): TransactionLifecycle {
    switch (status) {
      case 'confirmed': return 'confirmed';
      case 'pending': return 'pending';
      case 'failed': return 'failed';
      default: return 'pending';
    }
  }

  private lifecycleToStatus(lifecycle: TransactionLifecycle): TransactionReceipt['status'] {
    switch (lifecycle) {
      case 'confirmed': return 'confirmed';
      case 'failed': return 'failed';
      default: return 'pending';
    }
  }
}

export const transactionReceiptStore = new TransactionReceiptStore();
