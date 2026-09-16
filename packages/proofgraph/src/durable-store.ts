/**
 * Durable `ProofGraphStoragePort` adapter for @totemsdk/proofgraph.
 *
 * Implements RFC-007 G8 / §4.3: graph + reverse node index are persisted over a
 * shared `StorageAdapter`, with restart recovery and concurrent-update safety
 * (CAS guards on the head pointer and node index, serialized per adapter).
 *
 * Layout (single `StorageAdapter`, prefixed keys):
 *   graph:<graphId>          { json, savedAt }   immutable content-addressed record
 *   node:<nodeId>            { graphId, savedAt } reverse index (most-recent
 *                           snapshot that contains the node)
 *   head                     { graphId, savedAt } most-recent saved graph
 *
 * `load()` runs `importProofGraph`, which validates every node/edge and
 * recomputes the graphId — a tampered or truncated record surfaces as
 * `StorageError` `corrupt`, never as `not-found` (RFC-007 §4.2 strict).
 */

import type { StorageAdapter } from '@totemsdk/core';
import type {
  CasStore,
  StorageAdapterWithCapabilities,
  WriteAckMode,
} from '@totemsdk/storage/types';
import { assertCapabilities } from '@totemsdk/storage/types';
import { StorageError } from '@totemsdk/storage/errors';
import type { ProofGraph, ProofGraphStoragePort } from './types.js';
import { exportProofGraph, importProofGraph } from './io.js';

const DEFAULT_NAMESPACE = 'totem_proofgraph:v1:';
const GRAPH_PREFIX = 'graph:';
const NODE_PREFIX = 'node:';
const HEAD_KEY = 'head';

export interface DurableProofGraphStoreOptions {
  /** Key prefix (default 'totem_proofgraph:v1:'). */
  namespace?: string;
  /**
   * Required write-ack level the backing adapter must satisfy (default
   * 'durably-acknowledged').
   */
  requireAckMode?: WriteAckMode;
}

export interface ProofGraphRecoveryReport {
  recoveredHead: boolean;
  cleanedIndexKeys: number;
}

interface GraphRecord {
  json: string;
  savedAt: number;
}

interface IndexRecord {
  graphId: string;
  savedAt: number;
}

/** Per-adapter mutation lock so concurrent saves never interleave (wots-lease pattern). */
const storageTails = new WeakMap<object, Promise<void>>();

function withStorageLock<T>(storage: StorageAdapter, fn: () => Promise<T>): Promise<T> {
  const previous = storageTails.get(storage) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  storageTails.set(storage, previous.then(() => gate));
  return previous.then(() => fn()).finally(release);
}

function isCasStore(adapter: StorageAdapter): adapter is StorageAdapter & CasStore {
  return typeof (adapter as unknown as CasStore).conditionalUpdate === 'function';
}

export type DurableProofGraphStore = ProofGraphStoragePort & {
  /** Load the most-recent saved graph (the head). */
  latest(): Promise<ProofGraph | null>;
  /** List all persisted graphIds. */
  listGraphIds(): Promise<string[]>;
  /** Reconcile head + index after a crash/interruption. */
  recover(): Promise<ProofGraphRecoveryReport>;
};

/**
 * Create a durable `ProofGraphStoragePort` over a CAS-capable adapter.
 *
 * The head pointer and every reverse-index entry are guarded with the
 * adapter's `conditionalUpdate`, and all mutations run serialized per adapter,
 * so concurrent saves never clobber a newer graph. A non-CAS or low-durability
 * adapter is rejected at construction (RFC-007 §4.2 no-silent-downgrade).
 */
export function createDurableProofGraphStore(
  adapter: StorageAdapter,
  options: DurableProofGraphStoreOptions = {},
): DurableProofGraphStore {
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;

  if (typeof (adapter as StorageAdapterWithCapabilities).capabilities === 'object') {
    assertCapabilities(adapter as StorageAdapterWithCapabilities, {
      acknowledge: options.requireAckMode ?? 'durably-acknowledged',
      atomic: true,
      conditional: true,
    });
  }
  if (!isCasStore(adapter)) {
    throw new Error('createDurableProofGraphStore requires a CAS-capable storage adapter (CasStore.conditionalUpdate)');
  }

  const cas = (adapter as StorageAdapter & CasStore).conditionalUpdate.bind(adapter);

  const graphKey = (graphId: string): string => `${namespace}${GRAPH_PREFIX}${graphId}`;
  const nodeKey = (nodeId: string): string => `${namespace}${NODE_PREFIX}${nodeId}`;
  const headKey = (): string => `${namespace}${HEAD_KEY}`;

  /** Strictly-increasing savedAt so concurrent saves have deterministic order. */
  let lastSavedAt = 0;
  const nextSavedAt = (): number => {
    const now = Date.now();
    lastSavedAt = now > lastSavedAt ? now : lastSavedAt + 1;
    return lastSavedAt;
  };

  function parseGraph(graphId: string, raw: unknown): ProofGraph {
    if (typeof raw !== 'string' && (typeof raw !== 'object' || raw === null || typeof (raw as GraphRecord).json !== 'string')) {
      throw new StorageError(`proofgraph record "${graphId}" is malformed`, 'corrupt', { key: graphKey(graphId) });
    }
    const json = typeof raw === 'string' ? raw : (raw as GraphRecord).json;
    try {
      return importProofGraph(json);
    } catch (err) {
      throw new StorageError(
        `proofgraph record "${graphId}" failed validation: ${(err as Error).message}`,
        'corrupt',
        { key: graphKey(graphId), cause: err },
      );
    }
  }

  async function loadUnchecked(graphId: string): Promise<ProofGraph | null> {
    const raw = await adapter.get<GraphRecord | string>(graphKey(graphId));
    if (raw === null || raw === undefined) return null;
    return parseGraph(graphId, raw);
  }

  async function loadGraphForNode(nodeId: string): Promise<ProofGraph | null> {
    const entry = await adapter.get<IndexRecord>(nodeKey(nodeId));
    if (entry === null || entry === undefined) return null;
    return loadUnchecked(entry.graphId);
  }

  async function writeIndexIfNewer(key: string, next: IndexRecord): Promise<void> {
    await cas<IndexRecord>(key, (current) => {
      if (current && current.savedAt > next.savedAt) return { abort: 'older snapshot' };
      return { next };
    });
  }

  return {
    async save(graph: ProofGraph): Promise<void> {
      const savedAt = nextSavedAt();
      return withStorageLock(adapter, async () => {
        // Immutable content-addressed record first (idempotent, safe on retry).
        const record: GraphRecord = { json: exportProofGraph(graph), savedAt };
        await adapter.set(graphKey(graph.graphId), record);

        // Reverse index: most-recent snapshot wins (CAS, never clobbers newer).
        for (const node of graph.nodes) {
          await writeIndexIfNewer(nodeKey(node.id), { graphId: graph.graphId, savedAt });
        }

        // Head pointer: does not move backwards.
        await writeIndexIfNewer(headKey(), { graphId: graph.graphId, savedAt });
      });
    },

    async load(graphId: string): Promise<ProofGraph | null> {
      return loadUnchecked(graphId);
    },

    async findByNodeId(id: string): Promise<ProofGraph | null> {
      return loadGraphForNode(id);
    },

    async latest(): Promise<ProofGraph | null> {
      const head = await adapter.get<IndexRecord>(headKey());
      if (head === null || head === undefined) return null;
      return loadUnchecked(head.graphId);
    },

    async listGraphIds(): Promise<string[]> {
      const prefix = `${namespace}${GRAPH_PREFIX}`;
      const ids: string[] = [];
      for (const key of await adapter.keys()) {
        if (!key.startsWith(prefix)) continue;
        ids.push(key.slice(prefix.length));
      }
      return ids.sort();
    },

    async recover(): Promise<ProofGraphRecoveryReport> {
      return withStorageLock(adapter, async () => {
        const report: ProofGraphRecoveryReport = { recoveredHead: false, cleanedIndexKeys: 0 };

        const graphs = await this.listGraphIds();
        const head = await adapter.get<IndexRecord>(headKey());

        // 1. Head pointer: if absent but graphs exist, adopt the newest record.
        if ((head === null || head === undefined) && graphs.length > 0) {
          let newest: IndexRecord | null = null;
          for (const graphId of graphs) {
            const record = await adapter.get<GraphRecord>(graphKey(graphId));
            if (!record) continue;
            if (!newest || record.savedAt > newest.savedAt) {
              newest = { graphId, savedAt: record.savedAt };
            }
          }
          if (newest) {
            await writeIndexIfNewer(headKey(), newest);
            report.recoveredHead = true;
          }
        }

        // 2. Drop reverse-index entries pointing at absent graph records.
        const nodePrefix = `${namespace}${NODE_PREFIX}`;
        for (const key of await adapter.keys()) {
          if (!key.startsWith(nodePrefix)) continue;
          const entry = await adapter.get<IndexRecord>(key);
          if (!entry) continue;
          const graphRecord = await adapter.get<GraphRecord>(graphKey(entry.graphId));
          if (graphRecord === null || graphRecord === undefined) {
            await adapter.remove(key);
            report.cleanedIndexKeys++;
          }
        }

        return report;
      });
    },
  };
}