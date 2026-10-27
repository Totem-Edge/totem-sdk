/**
 * RFC-057 Phase 4 — replicated proofgraph evidence network.
 *
 * Evidence bytes live in the digest-verified artifact store; the replicated
 * index maps a proofgraph evidence node to its artifact ref. Reads re-verify
 * the artifact digest, so an independently replicated index can never turn a
 * corrupt or substituted artifact into accepted evidence.
 */

import { sha3_256, toHex } from '@totemsdk/core';
import type { ArtifactRef, ArtifactStore } from '@totemsdk/storage/artifacts';
import { StorageError } from '@totemsdk/storage/errors';

export interface EvidenceGraphNode {
  readonly id: string;
  readonly type: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface EvidenceGraph {
  readonly nodes: ReadonlyArray<EvidenceGraphNode>;
}

export interface EvidenceIndexPort {
  get(key: string): Promise<unknown | null>;
  put(key: string, value: unknown): Promise<void>;
  list?(prefix?: string): AsyncIterable<{ key: string; value: unknown }>;
}

export interface EvidenceIndexEntry {
  readonly nodeId: string;
  readonly ref: ArtifactRef;
  readonly contentHash: string;
  readonly storedAt: number;
}

export interface EvidenceNetworkRead {
  readonly nodeId: string;
  readonly status: 'ok' | 'not-found' | 'corrupt' | 'unavailable';
  readonly ref?: ArtifactRef;
  readonly bytes?: Uint8Array;
  readonly message?: string;
}

export interface ReplicatedEvidenceNetwork {
  putEvidence(
    graph: EvidenceGraph,
    bytesFor: (nodeId: string) => Uint8Array | undefined,
  ): Promise<ArtifactRef[]>;
  getEvidence(nodeId: string): Promise<EvidenceNetworkRead>;
  verifyEvidence(nodeId: string): Promise<boolean>;
  listEvidence(): AsyncIterable<EvidenceIndexEntry>;
}

const DEFAULT_NAMESPACE = 'totem-proofgraph-evidence';
const KEY_PREFIX = 'proofgraph:evidence:';

function normalizeHash(hash: string): string {
  return hash.replace(/^0x/i, '').toLowerCase();
}

function evidenceNodes(graph: EvidenceGraph): EvidenceGraphNode[] {
  return graph.nodes.filter((node) => node.type === 'evidence');
}

function contentHashOf(node: EvidenceGraphNode): string | undefined {
  const value = node.data?.contentHash;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function createReplicatedEvidenceNetwork(options: {
  artifacts: ArtifactStore;
  index: EvidenceIndexPort;
  namespace?: string;
}): ReplicatedEvidenceNetwork {
  if (!options.artifacts.capabilities.writable) {
    throw new Error('replicated evidence network requires a writable artifact store');
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
          throw new StorageError(
            `evidence commitment mismatch for node "${node.id}"`,
            'corrupt',
            { key: key(node.id) },
          );
        }
        const receipt = await options.artifacts.put(namespace, bytes);
        if (contentHash && normalizeHash(contentHash) !== receipt.ref.digest) {
          throw new StorageError(
            `artifact digest mismatch for node "${node.id}"`,
            'corrupt',
            { key: key(node.id) },
          );
        }
        const entry: EvidenceIndexEntry = {
          nodeId: node.id,
          ref: receipt.ref,
          contentHash: contentHash ?? receipt.ref.digest,
          storedAt: Date.now(),
        };
        await options.index.put(key(node.id), entry);
        refs.push(receipt.ref);
      }
      return refs;
    },

    async getEvidence(nodeId) {
      const raw = await options.index.get(key(nodeId));
      if (!raw) return { nodeId, status: 'not-found' };
      const entry = raw as EvidenceIndexEntry;
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
        yield entry.value as EvidenceIndexEntry;
      }
    },
  };
}
