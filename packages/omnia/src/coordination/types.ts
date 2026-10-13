/**
 * Coordination types (RFC-035 Phase B).
 *
 * A durable, verified round-trip layer for the structurally multi-party Omnia
 * operations (factory N-of-N open/close, virtual-channel open, splice). This
 * module holds the transport/state-machine pieces shared by those flows; the
 * factory/splice-specific orchestration lives in their own packages.
 */

import type { OmniaMessage, OmniaMessageType, OmniaPeer } from '../messaging-types.js';

export type CoordinationKind = Extract<
  OmniaMessageType,
  | 'FACTORY_PROPOSAL'
  | 'FACTORY_ACCEPT'
  | 'FACTORY_CLOSE_PROPOSAL'
  | 'FACTORY_CLOSE_ACCEPT'
  | 'FACTORY_CLOSE_FINALIZED'
  | 'FACTORY_FINALIZED'
  | 'VC_PROPOSAL'
  | 'VC_ACCEPT'
  | 'SPLICE_PROPOSAL'
  | 'SPLICE_ACCEPT'
  | 'SPLICE_FINALIZED'
>;

export const COORDINATION_KINDS: readonly CoordinationKind[] = [
  'FACTORY_PROPOSAL',
  'FACTORY_ACCEPT',
  'FACTORY_CLOSE_PROPOSAL',
  'FACTORY_CLOSE_ACCEPT',
  'FACTORY_CLOSE_FINALIZED',
  'FACTORY_FINALIZED',
  'VC_PROPOSAL',
  'VC_ACCEPT',
  'SPLICE_PROPOSAL',
  'SPLICE_ACCEPT',
  'SPLICE_FINALIZED',
];

export function isCoordinationKind(kind: OmniaMessageType): kind is CoordinationKind {
  return (COORDINATION_KINDS as readonly string[]).includes(kind);
}

export interface CoordinationPolicy {
  /** When true, accept without an approval round-trip (never in a wallet). */
  autoAccept?: boolean;
  /** Proposal TTL in ms (default 24h). */
  ttlMs?: number;
}

export type ProposalState = 'pending' | 'accepted' | 'committed' | 'abandoned';

export interface ProposalRecord {
  correlationId: string;
  kind: CoordinationKind;
  channelId: string;
  payload: unknown;
  state: ProposalState;
  createdAt: number;
  expiresAt: number;
  /** Peer pubkeys (routing identity) the proposal was sent to. */
  peers: string[];
}

export interface AcceptanceRecord {
  correlationId: string;
  partyId: string;
  message: OmniaMessage;
  acceptedAt: number;
}

export interface CoordinationStore {
  putProposal(record: ProposalRecord): Promise<void>;
  getProposal(correlationId: string): Promise<ProposalRecord | null>;
  setProposalState(correlationId: string, state: ProposalState): Promise<void>;
  /** Idempotent: returns false when this party already had an acceptance. */
  recordAcceptance(correlationId: string, partyId: string, message: OmniaMessage): Promise<boolean>;
  listAcceptances(correlationId: string): Promise<AcceptanceRecord[]>;
  deleteProposal(correlationId: string): Promise<boolean>;
}

export interface CoordinationContext {
  peer: OmniaPeer;
  /** Routing identity (`peer.pubkey`) — never trusted for authorization. */
  from: string;
  message: OmniaMessage;
  correlationId: string;
  /** The coordination store (read the originating proposal, record state). */
  store: CoordinationStore;
  /** The active policy (consent + TTL). */
  policy: Required<CoordinationPolicy>;
  /** Reply on the same peer/correlation. */
  send: (type: OmniaMessageType, payload: unknown) => Promise<void>;
  /** Send on any peer (same correlationId) — e.g. FINALIZED fan-out to all signers. */
  sendTo: (peer: OmniaPeer, type: OmniaMessageType, payload: unknown) => Promise<void>;
}

export type CoordinationHandler = (ctx: CoordinationContext) => Promise<void>;
export type CoordinationHandlers = Partial<Record<CoordinationKind, CoordinationHandler>>;
