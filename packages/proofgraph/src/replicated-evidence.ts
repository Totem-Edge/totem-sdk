/**
 * RFC-057 Phase 4 — replicated proofgraph evidence adapter.
 *
 * Keeps the authoritative proofgraph evidence store local while allowing a
 * replicated index to locate the same digest-verified artifacts on other
 * peers. The replicated index is never trusted for bytes: every read
 * re-verifies the artifact digest.
 */

import { sha3_256, toHex } from '@totemsdk/core';
import type { ArtifactRef, ArtifactStore } from '@totemsdk/storage/artifacts';
import { StorageError } from '@totemsdk/storage/errors';
import type { ProofGraph } from './types.js';

const KEY_PREFIX = 'proofgraph:evidence:';
const DEFAULT_NAMESPACE = 'totem-proofgraph-evidence';

export interface ReplicatedEvidenceIndexEntry {
  readonly nodeId: string;
  readonly ref: ArtifactRef;
  readonly contentHash: string;
  readonly storedAt: number;
}

export interface ReplicatedEvidenceIndexPort {
  get(key: string): Promise<unknown | null>;
  put(key: string, value: unknown): Promise<void>;
  list?(prefix?: string): AsyncIterable<{ key: string; value: unknown }>;
}

export interface ReplicatedEvidenceRead {
  readonly nodeId: string;
  readonly status: 'ok' | 'not-found' | 'corrupt' | 'unavailable';
  readonly ref?: ArtifactRef;
  readonly bytes?: Uint8Array;
  readonly message?: string;
}

export interface ReplicatedProofGraphEvidenceStore {
  putEvidence(
    graph: ProofGraph,
    bytesFor: (nodeId: string) => Uint8Array | undefined,
  ): Promise<ArtifactRef[]>;
  getEvidence(nodeId: string): Promise<ReplicatedEvidenceRead>;
  verifyEvidence(nodeId: string): Promise<boolean>;
  listEvidence(): AsyncIterable<ReplicatedEvidenceIndexEntry>;
}

function normalizeHash(value: string): string {
  return value.replace(/^0x/i, '').toLowerCase();
}

function evidenceNodes(graph: ProofGraph) {
  return graph.nodes.filter((node) => node.type === 'evidence');
}

function contentHashOf(node: { data?: Record<string, unknown> }): string | undefined {
  const value = node.data?.contentHash;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function createReplicatedProofGraphEvidenceStore(options: {
  artifacts: ArtifactStore;
  index: ReplicatedEvidenceIndexPort;
  namespace?: string;
}): ReplicatedProofGraphEvidenceStore {
  if (!options.artifacts.capabilities.writable) {
    throw new Error('replicated evidence store requires a writable artifact store');
  }
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  const key = (nodeId: string): string => `${KEY_PREFIX}${nodeId}`;

  return {
    async putEvidence(graph, bytesFor) {
      const refs: ArtifactRef[] = [];
      for (const node of evidenceNodes(graph)) {
        const bytes = bytesFor(node.id);
        if (!bytes) continue;
        const digest = toHex(sha3_256(bytes));
        const contentHash = contentHashOf(node);
        if (contentHash && normalizeHash(contentHash) !== digest) {
          throw new StorageError(`evidence commitment mismatch for node "${node.id}"`, 'corrupt', {
            key: key(node.id),
          });
        }
        const receipt = await options.artifacts.put(namespace, bytes);
        if (contentHash && normalizeHash(contentHash) !== receipt.ref.digest) {
          throw new StorageError(`artifact digest mismatch for node "${node.id}"`, 'corrupt', {
            key: key(node.id),
          });
        }
        await options.index.put(key(node.id), {
          nodeId: node.id,
          ref: receipt.ref,
          contentHash: contentHash ?? receipt.ref.digest,
          storedAt: Date.now(),
        } satisfies ReplicatedEvidenceIndexEntry);
        refs.push(receipt.ref);
      }
      return refs;
    },

    async getEvidence(nodeId) {
      const raw = await options.index.get(key(nodeId));
      if (!raw) return { nodeId, status: 'not-found' };
      const entry = raw as ReplicatedEvidenceIndexEntry;
      const read = await options.artifacts.get(entry.ref);
      if (read.status !== 'ok' || !read.bytes) {
        return {
          nodeId,
          status: read.status,
          ref: entry.ref,
          ...(read.message ? { message: read.message } : {}),
        };
      }
      const digest = toHex(sha3_256(read.bytes));
      if (normalizeHash(entry.contentHash) !== digest) {
        return {
          nodeId,
          status: 'corrupt',
          ref: entry.ref,
          message: `evidence digest mismatch: ${digest} !== ${entry.contentHash}`,
        };
      }
      return { nodeId, status: 'ok', ref: entry.ref, bytes: read.bytes };
    },

    async verifyEvidence(nodeId) {
      return (await this.getEvidence(nodeId)).status === 'ok';
    },

    async *listEvidence() {
      if (!options.index.list) return;
      for await (const entry of options.index.list(KEY_PREFIX)) {
        yield entry.value as ReplicatedEvidenceIndexEntry;
      }
    },
  };
}
