/**
 * Durable proposal/acceptance stores (RFC-035 §6.4).
 *
 * Proposals are keyed by `correlationId`; acceptances by
 * `(correlationId, partyId)`. Handlers are idempotent: a re-delivered
 * acceptance for a recorded party is ignored.
 */

import type { StorageAdapter } from '@totemsdk/core';
import type { OmniaMessage } from '../messaging-types.js';
import type {
  AcceptanceRecord,
  CoordinationStore,
  ProposalRecord,
  ProposalState,
} from './types.js';

const PROPOSAL_PREFIX = 'omnia:coord:proposal:';
const ACCEPTANCE_PREFIX = 'omnia:coord:acceptance:';

function acceptanceKey(correlationId: string, partyId: string): string {
  return `${ACCEPTANCE_PREFIX}${correlationId}::${partyId}`;
}

export function createMemoryCoordinationStore(): CoordinationStore {
  const proposals = new Map<string, ProposalRecord>();
  const acceptances = new Map<string, AcceptanceRecord>();

  return {
    async putProposal(record) {
      proposals.set(record.correlationId, record);
    },
    async getProposal(correlationId) {
      return proposals.get(correlationId) ?? null;
    },
    async setProposalState(correlationId, state) {
      const rec = proposals.get(correlationId);
      if (rec) proposals.set(correlationId, { ...rec, state });
    },
    async recordAcceptance(correlationId, partyId, message) {
      const key = acceptanceKey(correlationId, partyId);
      if (acceptances.has(key)) return false;
      acceptances.set(key, { correlationId, partyId, message, acceptedAt: Date.now() });
      return true;
    },
    async listAcceptances(correlationId) {
      return [...acceptances.values()].filter((a) => a.correlationId === correlationId);
    },
    async deleteProposal(correlationId) {
      return proposals.delete(correlationId);
    },
  };
}

export function createStorageCoordinationStore(adapter: StorageAdapter): CoordinationStore {
  return {
    async putProposal(record) {
      await adapter.set(`${PROPOSAL_PREFIX}${record.correlationId}`, record);
    },
    async getProposal(correlationId) {
      return adapter.get<ProposalRecord>(`${PROPOSAL_PREFIX}${correlationId}`);
    },
    async setProposalState(correlationId, state: ProposalState) {
      const rec = await adapter.get<ProposalRecord>(`${PROPOSAL_PREFIX}${correlationId}`);
      if (rec) await adapter.set(`${PROPOSAL_PREFIX}${correlationId}`, { ...rec, state });
    },
    async recordAcceptance(correlationId, partyId, message) {
      const key = acceptanceKey(correlationId, partyId);
      if (await adapter.has(key)) return false;
      const record: AcceptanceRecord = { correlationId, partyId, message, acceptedAt: Date.now() };
      await adapter.set(key, record);
      return true;
    },
    async listAcceptances(correlationId) {
      const keys = await adapter.keys();
      const prefix = `${ACCEPTANCE_PREFIX}${correlationId}::`;
      const out: AcceptanceRecord[] = [];
      for (const key of keys) {
        if (!key.startsWith(prefix)) continue;
        const record = await adapter.get<AcceptanceRecord>(key);
        if (record) out.push(record);
      }
      return out;
    },
    async deleteProposal(correlationId) {
      return adapter.remove(`${PROPOSAL_PREFIX}${correlationId}`);
    },
  };
}

/** A message that carries a coordination correlation id. */
export function correlationIdOf(message: OmniaMessage): string | undefined {
  return message.correlationId;
}
