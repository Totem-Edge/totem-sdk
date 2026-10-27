/**
 * RFC-057 Phase 4 — replicated agent receipt audit store.
 *
 * Receipts remain records of what the authority layer decided. Replication
 * makes the audit trail durable; it never grants execution or changes a
 * receipt's status.
 */

import { sha256 } from '@noble/hashes/sha256.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import type { ReplicatedLog } from '@totemsdk/replication';
import type { ReceiptStore } from './receipt-store.js';
import type { AgentReceipt } from './types.js';

export class ReplicatedReceiptStore implements ReceiptStore {
  constructor(private readonly log: ReplicatedLog<AgentReceipt>) {}

  async save(receipt: AgentReceipt): Promise<string> {
    const receiptId = `rcpt-${bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(receipt)))).slice(0, 32)}`;
    await this.log.append(receipt);
    return receiptId;
  }

  async get(receiptId: string): Promise<AgentReceipt | null> {
    for (const receipt of await this.all()) {
      if (receiptIdFor(receipt) === receiptId) return receipt;
    }
    return null;
  }

  async list(limit = 50, offset = 0): Promise<AgentReceipt[]> {
    return (await this.all()).reverse().slice(offset, offset + limit);
  }

  async count(): Promise<number> {
    return (await this.all()).length;
  }

  private async all(): Promise<AgentReceipt[]> {
    const receipts: AgentReceipt[] = [];
    for await (const entry of this.log.readSince()) receipts.push(entry.record);
    return receipts;
  }
}

function receiptIdFor(receipt: AgentReceipt): string {
  return `rcpt-${bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(receipt)))).slice(0, 32)}`;
}
