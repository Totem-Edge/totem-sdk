/** RFC-057 Phase 4 — replicated governance audit timeline (non-authoritative). */

import type { ReplicatedLog } from '@totemsdk/replication';
import type { MandateReceipt, Proposal, ProposalOutcome, Vote } from './types.js';

export type GovernanceAuditRecord =
  | { readonly kind: 'proposal'; readonly proposal: Proposal }
  | { readonly kind: 'vote'; readonly vote: Vote }
  | { readonly kind: 'outcome'; readonly outcome: ProposalOutcome }
  | { readonly kind: 'mandate'; readonly receipt: MandateReceipt };

export class ReplicatedGovernanceAudit {
  constructor(private readonly log: ReplicatedLog<GovernanceAuditRecord>) {}

  async append(record: GovernanceAuditRecord): Promise<{ length: number; head: string }> {
    return this.log.append(record);
  }

  readSince(cursor?: string): AsyncIterable<{ cursor: string; record: GovernanceAuditRecord }> {
    return this.log.readSince(cursor);
  }

  close(): Promise<void> {
    return this.log.close();
  }
}
