import type { AgentReceipt } from './types.js';
import { createHash } from 'node:crypto';

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
  private readonly ready: Promise<void>;

  constructor(opts?: { filePath?: string }) {
    this.filePath = opts?.filePath;
    this.ready = this.filePath ? this.loadFromFile() : Promise.resolve();
  }

  async save(receipt: AgentReceipt): Promise<string> {
    await this.ready;
    const receiptId = `rcpt-${createHash('sha256').update(JSON.stringify(receipt)).digest('hex').slice(0, 32)}`;
    this.receipts.set(receiptId, receipt);
    if (this.filePath) {
      await this.appendToFile(receiptId, receipt);
    }
    return receiptId;
  }

  async get(receiptId: string): Promise<AgentReceipt | null> {
    await this.ready;
    return this.receipts.get(receiptId) ?? null;
  }

  async list(limit: number = 50, offset: number = 0): Promise<AgentReceipt[]> {
    await this.ready;
    const entries = [...this.receipts.entries()].reverse();
    return entries.slice(offset, offset + limit).map(([_, r]) => r);
  }

  async count(): Promise<number> {
    await this.ready;
    return this.receipts.size;
  }

  private async loadFromFile(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(this.filePath!, 'utf8');
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        const record = JSON.parse(line) as { receiptId?: string; receipt?: AgentReceipt };
        if (record.receiptId && record.receipt) this.receipts.set(record.receiptId, record.receipt);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw error;
    }
  }

  private async appendToFile(receiptId: string, receipt: AgentReceipt): Promise<void> {
    await this.ready;
    const fs = await import('fs/promises');
    const line = JSON.stringify({ receiptId, receipt, savedAt: Date.now() }) + '\n';
    await fs.appendFile(this.filePath!, line, 'utf-8');
  }
}
