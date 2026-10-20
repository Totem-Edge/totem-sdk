/**
 * Routing engine contracts (RFC-055 Phase 1).
 *
 * Internal module: not exported from the package barrel until the semantics are
 * sufficiently tested. `findRoute` and `findCrossTokenRoute` consume it.
 */
import type { ChannelGraph, Route } from './types.js';
import {
  bfsLayers,
  bfsRoute,
  computeLayers,
  defaultEdgeFee,
  isZeroFeeToken,
  reconstructFromLayers,
  routeFromLayers,
  type FeeFunction,
  type SearchLabel,
} from './bounded-search.js';
import { getGraphRevisions } from './graph.js';

export const DEFAULT_MAX_HOPS = 8;

export interface RoutingGraphRevision {
  topology: number;
  economics: number;
  live: number;
}

export interface RoutingGraphSnapshot {
  readonly graph: ChannelGraph;
  readonly revision: RoutingGraphRevision;
}

export function createRoutingGraphSnapshot(graph: ChannelGraph): RoutingGraphSnapshot {
  return { graph, revision: getGraphRevisions(graph) };
}

export interface RoutingQuery {
  source: string;
  destination?: string;
  amount: bigint;
  tokenId: string;
  targetToken?: string;
  /** `undefined` ⇒ default 8; `null` ⇒ unbounded (rejected until implemented). */
  maxHops?: number | null;
  objective?: 'fees-then-hops';
  costModelId?: string;
}

/**
 * Versioned cost-model contract. The current model is additive, fixed-amount
 * and non-negative; future models declare amount dependence explicitly.
 */
export interface RoutingCostModel {
  readonly id: string;
  readonly nonNegative: boolean;
  readonly additive: boolean;
  readonly amountDependent: boolean;
  edgeFee: FeeFunction;
  compare(a: { fees: bigint; hops: number }, b: { fees: bigint; hops: number }): number;
}

export const FIXED_AMOUNT_COST_MODEL: RoutingCostModel = {
  id: 'fixed-amount-v1',
  nonNegative: true,
  additive: true,
  amountDependent: false,
  edgeFee: defaultEdgeFee,
  compare(a, b) {
    if (a.fees < b.fees) return -1;
    if (a.fees > b.fees) return 1;
    return a.hops - b.hops;
  },
};

export class UnsupportedRoutingModeError extends Error {
  constructor(readonly mode: string) {
    super(`Routing mode unsupported: ${mode}`);
    this.name = 'UnsupportedRoutingModeError';
  }
}

export interface RoutingTreeLabel {
  readonly hops: number;
  readonly totalFees: bigint;
  readonly route: Route;
}

/** Reusable one-to-many search result. Routes are reconstructed on demand. */
export interface RoutingTree {
  readonly source: string;
  readonly amount: bigint;
  readonly tokenId: string;
  readonly maxHops: number;
  readonly revision: RoutingGraphRevision;
  readonly costModelId: string;
  readonly destinations: readonly string[];
  labelAt(destination: string, hops: number): RoutingTreeLabel | null;
  routeTo(destination: string): Route | null;
}

export interface RoutingEngineCapabilities {
  readonly bounded: boolean;
  readonly unbounded: boolean;
  readonly oneToMany: boolean;
  readonly incremental: boolean;
  readonly crossToken: boolean;
}

export interface RoutingEngine {
  readonly id: string;
  readonly capabilities: RoutingEngineCapabilities;
  findRoute(
    snapshot: RoutingGraphSnapshot,
    query: RoutingQuery,
    costModel?: RoutingCostModel,
  ): Route | null;
  computeTree(
    snapshot: RoutingGraphSnapshot,
    query: RoutingQuery,
    costModel?: RoutingCostModel,
  ): RoutingTree;
}

function resolveMaxHops(query: RoutingQuery): number {
  if (query.maxHops === undefined) return DEFAULT_MAX_HOPS;
  if (query.maxHops === null) throw new UnsupportedRoutingModeError('unbounded');
  if (!Number.isInteger(query.maxHops) || query.maxHops < 0) {
    throw new Error(`maxHops must be a non-negative integer (got ${String(query.maxHops)})`);
  }
  return query.maxHops;
}

class LayeredRoutingEngine implements RoutingEngine {
  readonly id = 'layered-bounded-v1';

  readonly capabilities: RoutingEngineCapabilities = {
    bounded: true,
    unbounded: false,
    oneToMany: true,
    incremental: false,
    crossToken: true,
  };

  findRoute(
    snapshot: RoutingGraphSnapshot,
    query: RoutingQuery,
    costModel: RoutingCostModel = FIXED_AMOUNT_COST_MODEL,
  ): Route | null {
    const maxHops = resolveMaxHops(query);
    if (query.amount <= 0n || !query.destination) return null;

    if (isZeroFeeToken(snapshot.graph, query.tokenId, query.amount, costModel.edgeFee)) {
      return bfsRoute(
        snapshot.graph,
        query.source,
        query.destination,
        query.amount,
        query.tokenId,
        maxHops,
      );
    }

    const layers = computeLayers(
      snapshot.graph,
      query.source,
      query.amount,
      query.tokenId,
      maxHops,
      costModel.edgeFee,
    );
    return routeFromLayers(layers, query.destination, query.amount, query.tokenId, maxHops);
  }

  computeTree(
    snapshot: RoutingGraphSnapshot,
    query: RoutingQuery,
    costModel: RoutingCostModel = FIXED_AMOUNT_COST_MODEL,
  ): RoutingTree {
    const maxHops = resolveMaxHops(query);
    let layers: Array<Map<string, SearchLabel>>;
    if (query.amount <= 0n) {
      layers = Array.from({ length: maxHops + 1 }, () => new Map<string, SearchLabel>());
    } else if (isZeroFeeToken(snapshot.graph, query.tokenId, query.amount, costModel.edgeFee)) {
      // Zero-fee trees carry shortest-hop labels only (longer zero-fee paths are never better).
      layers = bfsLayers(snapshot.graph, query.source, query.amount, query.tokenId, maxHops);
    } else {
      layers = computeLayers(
        snapshot.graph,
        query.source,
        query.amount,
        query.tokenId,
        maxHops,
        costModel.edgeFee,
      );
    }
    return createRoutingTree(snapshot, query, costModel, maxHops, layers);
  }
}

function createRoutingTree(
  snapshot: RoutingGraphSnapshot,
  query: RoutingQuery,
  costModel: RoutingCostModel,
  maxHops: number,
  layers: Array<Map<string, SearchLabel>>,
): RoutingTree {
  const destinations = new Set<string>();
  for (const layer of layers) {
    for (const node of layer.keys()) destinations.add(node);
  }

  const labelAt = (destination: string, hops: number): RoutingTreeLabel | null => {
    if (!Number.isInteger(hops) || hops < 0 || hops > maxHops) return null;
    const label = layers[hops]?.get(destination);
    if (!label) return null;

    const routeHops = reconstructFromLayers(
      layers,
      hops,
      destination,
      query.amount,
      query.tokenId,
    );
    return {
      hops,
      totalFees: label.totalFees,
      route: {
        hops: routeHops,
        totalFees: label.totalFees,
        tokenIn: query.tokenId,
        tokenOut: query.tokenId,
        estimatedBlocks: routeHops.length * 2,
      },
    };
  };

  return {
    source: query.source,
    amount: query.amount,
    tokenId: query.tokenId,
    maxHops,
    revision: snapshot.revision,
    costModelId: costModel.id,
    destinations: [...destinations].sort(),
    labelAt,
    routeTo(destination: string): Route | null {
      let bestH = -1;
      let bestFees = 0n;
      for (let h = 0; h <= maxHops; h++) {
        const label = layers[h]?.get(destination);
        if (!label) continue;
        if (
          bestH === -1 ||
          label.totalFees < bestFees ||
          (label.totalFees === bestFees && h < bestH)
        ) {
          bestH = h;
          bestFees = label.totalFees;
        }
      }
      if (bestH === -1) return null;
      return labelAt(destination, bestH)?.route ?? null;
    },
  };
}

const LAYERED_ENGINE = new LayeredRoutingEngine();

export function selectRoutingEngine(_snapshot: RoutingGraphSnapshot): RoutingEngine {
  return LAYERED_ENGINE;
}

/** Cache key includes every input that materially affects correctness. */
export function routeCacheKey(
  snapshot: RoutingGraphSnapshot,
  query: RoutingQuery,
  costModel: RoutingCostModel = FIXED_AMOUNT_COST_MODEL,
): string {
  return [
    snapshot.revision.topology,
    snapshot.revision.economics,
    snapshot.revision.live,
    query.source,
    query.destination ?? '*',
    query.amount.toString(),
    query.tokenId,
    query.targetToken ?? '',
    query.maxHops === null ? 'unbounded' : String(query.maxHops ?? 'default'),
    costModel.id,
  ].join('|');
}
