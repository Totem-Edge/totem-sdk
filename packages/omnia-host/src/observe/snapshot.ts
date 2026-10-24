import type { OmniaChannel } from "@totemsdk/omnia";
import type { ChannelFactory } from "@totemsdk/omnia-factory";


export interface ObservationSnapshotInput {
  networkId: string;
  sourceNodeId: string;
  streamId: string;
  cursor: number;
  channels?: Iterable<OmniaChannel>;
  factories?: Iterable<ChannelFactory>;
  vtxoPools?: Iterable<unknown>;
  vtxos?: Iterable<unknown>;
  pools?: Iterable<unknown>;
  operations?: { listByStatus?: (status: string) => unknown[] };
}

function toJson(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value;
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { bytes: (value as Uint8Array).length };
  }
  if (depth > 4) return "[depth-limit]";
  if (Array.isArray(value)) return value.map((v) => toJson(v, depth + 1));
  if (value instanceof Map) {
    return Object.fromEntries(Array.from(value.entries()).map(([k, v]) => [String(k), toJson(v, depth + 1)]));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (/seed|privatekey|secretkey|preimage|witness|signature/i.test(key)) continue;
      out[key] = toJson(nested, depth + 1);
    }
    return out;
  }
  return String(value);
}

function channelView(channel: OmniaChannel): Record<string, unknown> {
  return {
    channelId: channel.channelId,
    status: channel.status,
    channelType: channel.channelType,
    tokenId: channel.tokenId,
    tokenScale: channel.tokenScale ?? 0,
    totalValue: channel.totalValue.toString(),
    currentSequence: channel.currentSequence,
    fundingCoinId: channel.fundingCoinId,
    fundingTxId: channel.fundingTxId,
    parties: toJson(channel.parties),
    balances: Object.fromEntries(Object.entries(channel.balances).map(([k, v]) => [k, v.toString()])),
    pendingHTLCs: (channel.pendingHTLCs ?? []).map((h) => toJson(h)),
    updatedAt: channel.updatedAt,
  };
}

function factoryView(factory: ChannelFactory): Record<string, unknown> {
  const f = factory as unknown as Record<string, unknown>;
  const allocations = (f.allocations ?? {}) as Record<string, bigint>;
  return {
    factoryId: f.factoryId,
    status: f.status,
    tokenId: f.tokenId,
    tokenScale: f.tokenScale ?? 0,
    participants: toJson(f.participants),
    allocations: Object.fromEntries(Object.entries(allocations).map(([k, v]) => [k, v.toString()])),
    updatedAt: f.updatedAt,
  };
}

function operationsView(operations?: ObservationSnapshotInput["operations"]): unknown[] {
  if (!operations?.listByStatus) return [];
  const statuses = ["pending", "executing", "committed", "failed"];
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const status of statuses) {
    for (const record of operations.listByStatus(status) ?? []) {
      const r = record as { operationId?: string };
      if (r.operationId && seen.has(r.operationId)) continue;
      if (r.operationId) seen.add(r.operationId);
      out.push(toJson({
        operationId: r.operationId,
        status: (record as { status?: string }).status ?? status,
        updatedAt: (record as { updatedAt?: number }).updatedAt,
        error: (record as { error?: string }).error,
      }));
    }
  }
  return out;
}

/**
 * Snapshot the host's current state at a single journal boundary. The cursor is
 * the journal head, so `GET /observe/events?after=<cursor>` has no gap or
 * duplication relative to this snapshot.
 */
export interface ObservationSnapshotState {
  channels: unknown[];
  factories: unknown[];
  vtxoPools: unknown[];
  vtxos: unknown[];
  pools: unknown[];
  operations: unknown[];
}

export interface ObservationSnapshot {
  networkId: string;
  sourceNodeId: string;
  streamId: string;
  cursor: number;
  generatedAt: number;
  state: ObservationSnapshotState;
}

export function createObservationSnapshot(input: ObservationSnapshotInput): ObservationSnapshot {
  return {
    networkId: input.networkId,
    sourceNodeId: input.sourceNodeId,
    streamId: input.streamId,
    cursor: input.cursor,
    generatedAt: Date.now(),
    state: {
      channels: Array.from(input.channels ?? []).map(channelView),
      factories: Array.from(input.factories ?? []).map(factoryView),
      vtxoPools: Array.from(input.vtxoPools ?? []).map((v) => toJson(v)),
      vtxos: Array.from(input.vtxos ?? []).map((v) => toJson(v)),
      pools: Array.from(input.pools ?? []).map((v) => toJson(v)),
      operations: operationsView(input.operations),
    },
  };
}
