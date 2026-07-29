import type { AgentReceipt } from './types.js';

/**
 * ReceiptStore — persists AgentReceipt objects for audit trail.
 *
 * Default implementation stores receipts in memory. Callers can provide
 * a custom `save` function for file, database, or remote storage.
 */
export interface ReceiptStore {
  /** Persist a receipt. Returns a receiptId for retrieval. */
  save(receipt: AgentReceipt): Promise<string>;
  /** Retrieve a receipt by receiptId. */
  get(receiptId: string): Promise<AgentReceipt | null>;
  /** List all receipts, newest first. */
  list(limit?: number, offset?: number): Promise<AgentReceipt[]>;
  /** Total number of stored receipts. */
  count(): Promise<number>;
}

/**
 * In-memory receipt store with optional JSON-file persistence.
 *
 * @example
 * ```ts
 * // In-memory only
 * const store = new MemoryReceiptStore();
 *
 * // With file persistence
 * const store = new MemoryReceiptStore({ filePath: './data/receipts.jsonl' });
 * ```
 */
export class MemoryReceiptStore implements ReceiptStore {
  private readonly receipts: Map<string, AgentReceipt> = new Map();
  private readonly filePath?: string;

  constructor(opts?: { filePath?: string }) {
    this.filePath = opts?.filePath;
  }

  async save(receipt: AgentReceipt): Promise<string> {
    const receiptId = `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.receipts.set(receiptId, receipt);
    if (this.filePath) {
      await this.appendToFile(receiptId, receipt);
    }
    return receiptId;
  }

  async get(receiptId: string): Promise<AgentReceipt | null> {
    return this.receipts.get(receiptId) ?? null;
  }

  async list(limit: number = 50, offset: number = 0): Promise<AgentReceipt[]> {
    const entries = [...this.receipts.entries()].reverse();
    return entries.slice(offset, offset + limit).map(([_, r]) => r);
  }

  async count(): Promise<number> {
    return this.receipts.size;
  }

  private async appendToFile(receiptId: string, receipt: AgentReceipt): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const line = JSON.stringify({ receiptId, receipt, savedAt: Date.now() }) + '\n';
      await fs.appendFile(this.filePath!, line, 'utf-8');
    } catch {
      // File persistence is best-effort
    }
  }
}
