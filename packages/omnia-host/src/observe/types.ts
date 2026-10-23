/**
 * Omnia observation events (RFC-0011 Amendment A / RFC-048).
 *
 * One event is a durable, replayable record of a single domain transition. It is
 * intentionally richer than `AnalyticsEvent`: it carries identity, correlation,
 * exact values, chain/evidence refs and a compact before/after diff so a
 * consumer (the canary observer, an explorer, an agent) can reconstruct state
 * without guessing or polling.
 *
 * Money is always an exact string (atoms). Signatures/seeds/preimages are never
 * emitted — only hashes/indices.
 */

export type ObservationDomain =
  | "node"
  | "channel"
  | "funding"
  | "payment"
  | "settlement"
  | "factory"
  | "vtxo"
  | "pool"
  | "splice"
  | "transport"
  | "operation"
  | "command";

export type ObservationPhase =
  | "observed"
  | "proposed"
  | "accepted"
  | "prepared"
  | "executing"
  | "committed"
  | "broadcast"
  | "confirmed"
  | "closed"
  | "failed"
  | "recovered";

export type ObservationEntityType =
  | "node"
  | "channel"
  | "factory"
  | "virtual-channel"
  | "vtxo-pool"
  | "vtxo"
  | "pool"
  | "splice"
  | "payment"
  | "operation"
  | "command";

export interface ObservationEntity {
  type: ObservationEntityType;
  id: string;
  /** Funding generation for channels/factories; increments on splice/reopen. */
  generation?: number;
}

export interface OmniaObservation {
  schemaVersion: 1;
  networkId: string;
  sourceNodeId: string;
  streamId: string;
  /** Journal-assigned 1-based sequence (the resumable cursor). */
  sourceSequence: number;
  eventId: string;
  recordedAt: number;
  occurredAt: number;

  domain: ObservationDomain;
  kind: string;
  phase: ObservationPhase;

  /** Protocol-level identity of the underlying signed transition, if known. */
  transitionHash?: string;
  /** Caller-known operation correlation (propagated where peer messages allow). */
  operationId?: string;
  /** The command/message that caused this transition. */
  causationId?: string;

  entity: ObservationEntity;
  parties?: { local?: string; remote?: string };
  token?: { tokenId: string; scale: number };

  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  amounts?: {
    amountAtoms?: string;
    capacity?: string;
    fee?: string;
    balances?: Record<string, string>;
  };
  chain?: {
    fundingCoinId?: string;
    txpowId?: string;
    blockHeight?: number;
    confirmations?: number;
    txDigest?: string;
  };
  evidence?: {
    stateDigest?: string;
    signatureHashes?: string[];
    leaseIndices?: number[];
    peerPublicKeyDigest?: string;
    proofRefs?: string[];
    manifestId?: string;
  };

  /** True when the transition was simulated/fixture-backed. */
  simulated: boolean;
  /** Free-form, already-redacted extras. */
  data?: Record<string, unknown>;
}

/** A record before the journal assigns its sequence. */
export type ObservationRecord = Omit<OmniaObservation, "sourceSequence">;

export interface ObserveSnapshot {
  networkId: string;
  sourceNodeId: string;
  streamId: string;
  /** Journal head at snapshot time — pair with `GET /observe/events?after=`. */
  cursor: number;
  generatedAt: number;
  state: {
    channels: unknown[];
    factories: unknown[];
    vtxoPools: unknown[];
    vtxos: unknown[];
    pools: unknown[];
    operations: unknown[];
  };
}

export interface ObservationStore {
  append(record: ObservationRecord): Promise<{ seq: number; createdAt: number }>;
  readSince(seq: number): Promise<OmniaObservation[]>;
  tail(count: number): Promise<OmniaObservation[]>;
  head(): Promise<number>;
  count(): Promise<number>;
  close(): Promise<void>;
}
