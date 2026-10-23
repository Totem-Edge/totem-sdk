import { createHash, randomUUID } from "node:crypto";
import type { OmniaChannel } from "@totemsdk/omnia";
import type { ObservationBus } from "./bus.js";
import type {
  ObservationDomain,
  ObservationEntity,
  ObservationPhase,
  ObservationRecord,
  ObservationStore,
  OmniaObservation,
} from "./types.js";

const SECRET_KEY = /^(seed|seedphrase|mnemonic|privatekey|secretkey|preimage|witness|witnesshex|fundingwitness|keyfile|passphrase|password|token|signature)$/i;
const MAX_STRING = 512;
const MAX_ARRAY = 32;

export interface ObservationEmitterConfig {
  store: ObservationStore;
  bus: ObservationBus;
  networkId: string;
  sourceNodeId: string;
  streamId?: string;
  /** Mark events from fixture/simulated hosts. */
  simulated?: boolean;
  /** Called on emission failures (defaults to console.error). */
  onError?: (error: unknown) => void;
}

export interface EmitObservationInput {
  domain: ObservationDomain;
  kind: string;
  phase: ObservationPhase;
  entity: ObservationEntity;
  occurredAt?: number;
  operationId?: string;
  causationId?: string;
  transitionHash?: string;
  parties?: { local?: string; remote?: string };
  token?: { tokenId: string; scale: number };
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  amounts?: ObservationRecord["amounts"];
  chain?: ObservationRecord["chain"];
  evidence?: ObservationRecord["evidence"];
  simulated?: boolean;
  data?: Record<string, unknown>;
}

/** Stable hash for transition identity (never includes secrets). */
export function hashTransition(parts: Array<string | number | undefined | null>): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(String(part ?? ""), "utf8").update("\u0000");
  return "sha256:" + hash.digest("hex");
}

/** Hash a channel's signed commitment for cross-node correlation. */
export function channelTransitionHash(channel: OmniaChannel): string {
  const state = channel.latestState as
    | { sequence?: number; transactionHex?: string; signatures?: Record<string, unknown> }
    | undefined;
  return hashTransition([
    "channel",
    channel.channelId,
    channel.fundingCoinId,
    channel.currentSequence,
    state?.sequence,
    state?.transactionHex ? hashString(state.transactionHex) : undefined,
  ]);
}

export function hashString(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.length <= MAX_STRING) return value;
    return `${value.slice(0, MAX_STRING)}…[sha256:${hashString(value).slice(0, 16)}]`;
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { bytes: (value as Uint8Array).length, sha256: hashString(Buffer.from(value).toString("hex")).slice(0, 16) };
  }
  if (depth > 4) return "[depth-limit]";
  if (Array.isArray(value)) {
    const head = value.slice(0, MAX_ARRAY).map((v) => redact(v, depth + 1));
    return value.length > MAX_ARRAY ? [...head, `[${value.length - MAX_ARRAY} more]`] : head;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(key)) {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = redact(nested, depth + 1);
    }
    return out;
  }
  return String(value);
}

/**
 * Builds, redacts and persists observation events, then fans them out live.
 *
 * `emit()` never throws into a mutation: persistence/export failures are
 * reported out-of-band so a payment can never be blocked by the observer.
 */
export class ObservationEmitter {
  private readonly store: ObservationStore;
  private readonly bus: ObservationBus;
  private readonly networkId: string;
  private readonly sourceNodeId: string;
  private readonly streamId: string;
  private readonly simulated: boolean;
  private readonly onError: (error: unknown) => void;

  constructor(config: ObservationEmitterConfig) {
    this.store = config.store;
    this.bus = config.bus;
    this.networkId = config.networkId;
    this.sourceNodeId = config.sourceNodeId;
    this.streamId = config.streamId ?? `${config.sourceNodeId}:${config.networkId}`;
    this.simulated = config.simulated ?? false;
    this.onError = config.onError ?? ((err) => console.error("[omnia-observe] emit failed:", err));
  }

  async emit(input: EmitObservationInput): Promise<OmniaObservation | undefined> {
    const now = Date.now();
    const record: ObservationRecord = {
      schemaVersion: 1,
      networkId: this.networkId,
      sourceNodeId: this.sourceNodeId,
      streamId: this.streamId,
      eventId: randomUUID(),
      recordedAt: now,
      occurredAt: input.occurredAt ?? now,
      domain: input.domain,
      kind: input.kind,
      phase: input.phase,
      ...(input.transitionHash ? { transitionHash: input.transitionHash } : {}),
      ...(input.operationId ? { operationId: input.operationId } : {}),
      ...(input.causationId ? { causationId: input.causationId } : {}),
      entity: input.entity,
      ...(input.parties ? { parties: input.parties } : {}),
      ...(input.token ? { token: input.token } : {}),
      ...(input.before ? { before: redact(input.before) as Record<string, unknown> } : {}),
      ...(input.after ? { after: redact(input.after) as Record<string, unknown> } : {}),
      ...(input.amounts ? { amounts: input.amounts } : {}),
      ...(input.chain ? { chain: input.chain } : {}),
      ...(input.evidence ? { evidence: input.evidence } : {}),
      simulated: input.simulated ?? this.simulated,
      ...(input.data ? { data: redact(input.data) as Record<string, unknown> } : {}),
    };
    try {
      const { seq, createdAt } = await this.store.append(record);
      const observation: OmniaObservation = {
        ...record,
        sourceSequence: seq,
        recordedAt: createdAt,
      };
      this.bus.publish(observation);
      return observation;
    } catch (error) {
      this.onError(error);
      return undefined;
    }
  }
}
