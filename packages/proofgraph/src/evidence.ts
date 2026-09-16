/**
 * Durable evidence-chain owner for @totemsdk/proofgraph (RFC-007 G8 / §4.3).
 *
 * Evidence *bytes* are owned by the minimal `ArtifactStore` over a pluggable
 * backend; graph references alone do not satisfy the flight-evidence gate. This
 * module wires a ProofGraph's `evidence` nodes to content-addressed artifacts,
 * and restores the bytes on demand with commit-time digest verification.
 *
 * Restore semantics (RFC-007 §4.3): `corrupt` (bytes present but digest
 * mismatch — tampered or truncated) is surfaced strictly, never collapsed into
 * `not-found` (bytes absent); `unavailable` (backend unreachable, or the
 * backend deleted a blob the local index still references) is also surfaced.
 */

import type { ProofGraph } from './types.js';
import { ArtifactStore } from '@totemsdk/storage/artifacts';
import type { ArtifactRef } from '@totemsdk/storage/artifacts';
import { StorageError } from '@totemsdk/storage/errors';
import type { StorageAdapter } from '@totemsdk/core';

const DEFAULT_NS = 'totem-proofgraph-evidence';
const INDEX_PREFIX = 'totem_proofgraph_evidence:v1:';

export interface ProofGraphEvidenceStoreOptions {
  /** Namespace the ArtifactStore writes artifact bytes under. */
  namespace?: string;
  /**
   * true (default) — a `corrupt` or `unavailable` evidence read throws
   * `StorageError` (never fail-open). `not-found` is always returned as a
   * result, never thrown. Set false to return audit-able results instead.
   */
  strict?: boolean;
}

/** Per-evidence-node restore result. */
export interface ProofGraphEvidenceResult {
  nodeId: string;
  status: 'ok' | 'not-found' | 'corrupt' | 'unavailable';
  ref?: ArtifactRef;
  bytes?: Uint8Array;
  message?: string;
}

export interface ProofGraphEvidenceStore {
  /**
   * Persist evidence bytes for every `evidence` node of `graph`.
   * `bytesFor` maps a node id to the bytes to store; nodes with no bytes are
   * skipped. Returns the refs persisted, in graph node order.
   */
  putEvidence(
    graph: ProofGraph,
    bytesFor: (nodeId: string) => Uint8Array | undefined,
  ): Promise<ArtifactRef[]>;

  /**
   * Restore evidence bytes for every `evidence` node of `graph`, verifying
   * each artifact's committed digest on read. With `strict` (default), corrupt
   * or unavailable reads throw; otherwise a per-node result is returned.
   */
  restoreEvidence(graph: ProofGraph): Promise<ProofGraphEvidenceResult[]>;

  /** Count of local index entries (persisted evidence mappings). */
  listCount(): Promise<number>;
}

interface EvidenceIndexEntry {
  ref: ArtifactRef;
}

function evidenceNodeIds(graph: ProofGraph): string[] {
  return graph.nodes.filter((node) => node.type === 'evidence').map((node) => node.id);
}

export function createProofGraphEvidenceStore(
  artifacts: ArtifactStore,
  index: StorageAdapter,
  options: ProofGraphEvidenceStoreOptions = {},
): ProofGraphEvidenceStore {
  if (!artifacts.capabilities.writable) {
    throw new Error('createProofGraphEvidenceStore requires a writable artifact store');
  }
  const namespace = options.namespace ?? DEFAULT_NS;
  const strict = options.strict ?? true;

  const indexKey = (nodeId: string): string => `${INDEX_PREFIX}${nodeId}`;

  return {
    async putEvidence(graph, bytesFor) {
      const refs: ArtifactRef[] = [];
      for (const nodeId of evidenceNodeIds(graph)) {
        const bytes = bytesFor(nodeId);
        if (!bytes) continue;
        const receipt = await artifacts.put(namespace, bytes).catch((err: unknown) => {
          throw new StorageError(
            `evidence put failed for node "${nodeId}": ${(err as Error).message}`,
            'write-failed',
            { key: indexKey(nodeId), cause: err },
          );
        });
        await index.set(indexKey(nodeId), { ref: receipt.ref } satisfies EvidenceIndexEntry);
        refs.push(receipt.ref);
      }
      return refs;
    },

    async restoreEvidence(graph) {
      const results: ProofGraphEvidenceResult[] = [];
      const fail = (err: unknown): never => {
        if (err instanceof StorageError) throw err;
        throw new StorageError(`evidence read failed: ${(err as Error).message}`, 'unavailable', { cause: err });
      };

      for (const nodeId of evidenceNodeIds(graph)) {
        const entry = await index.get<EvidenceIndexEntry>(indexKey(nodeId));
        if (!entry) {
          results.push({ nodeId, status: 'not-found', message: 'no evidence artifact persisted for node' });
          continue;
        }
        const { ref } = entry;
        const read = await artifacts.get(ref).catch(fail);
        switch (read.status) {
          case 'ok':
            results.push({ nodeId, status: 'ok', ref, bytes: read.bytes });
            break;
          case 'corrupt':
            if (strict) {
              throw new StorageError(
                `evidence artifact corrupt for node "${nodeId}": ${read.message ?? 'digest mismatch'}`,
                'corrupt',
                { key: indexKey(nodeId) },
              );
            }
            results.push({ nodeId, status: 'corrupt', ref, message: read.message ?? 'digest mismatch' });
            break;
          case 'unavailable':
            if (strict) {
              throw new StorageError(
                `evidence artifact unavailable for node "${nodeId}": ${read.message ?? 'backend unavailable'}`,
                'unavailable',
                { key: indexKey(nodeId) },
              );
            }
            results.push({ nodeId, status: 'unavailable', ref, message: read.message ?? 'backend unavailable' });
            break;
          case 'not-found':
            results.push({ nodeId, status: 'not-found', ref, message: read.message ?? 'evidence artifact not found' });
            break;
        }
      }
      return results;
    },

    async listCount() {
      let count = 0;
      for (const key of await index.keys()) {
        if (key.startsWith(INDEX_PREFIX)) count++;
      }
      return count;
    },
  };
}