/** RFC-057 Phase 4 — replicated decision receipt graph. */

import type { ReplicatedLog } from '@totemsdk/replication';
import type { DecisionRefRecord } from './decision-ref.js';

export class ReplicatedDecisionReceiptLog {
  constructor(private readonly log: ReplicatedLog<DecisionRefRecord>) {}

  async append(record: DecisionRefRecord): Promise<{ length: number; head: string }> {
    if (!record.receiptId || !record.requestDigest) {
      throw new Error('decision receipt requires receiptId and requestDigest');
    }
    return this.log.append(record);
  }

  readSince(cursor?: string): AsyncIterable<{ cursor: string; record: DecisionRefRecord }> {
    return this.log.readSince(cursor);
  }

  close(): Promise<void> {
    return this.log.close();
  }
}
