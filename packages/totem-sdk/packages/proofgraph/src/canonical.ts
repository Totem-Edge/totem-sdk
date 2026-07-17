/**
 * Canonical JSON and ID rules for @totemsdk/proofgraph.
 *
 * canonicalJson is implemented fresh — @totemsdk/identity and @totemsdk/proof
 * each have their own copy; none of them export it publicly.
 *
 * ID rules:
 *   Node:  type + ":" + refId  (e.g. "proof:totem:proof:abc123")
 *   Edge:  sha3_256("totem-proofgraph-edge" + type + from + to + (proofId||'') + dataHash)
 *   Graph: sha3_256("totem-proofgraph" + canonicalJson(nodeHashes) + canonicalJson(sortedEdges))
 *          — node.createdAt and graph.metadata excluded from graphId (time-variant / mutable)
 */

import { sha3_256 } from '@totemsdk/core';
import type { ProofGraphNode, ProofGraphEdge } from './types.js';

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

export function computeNodeId(type: string, refId: string): string {
  return `${type}:${refId}`;
}

export function computeEdgeId(
  type: string,
  from: string,
  to: string,
  proofId: string | undefined,
  data: Record<string, unknown> | undefined,
): string {
  const canonicalDataHash = toHex(sha3_256(new TextEncoder().encode(canonicalJson(data ?? {}))));
  const input = 'totem-proofgraph-edge' + type + from + to + (proofId ?? '') + canonicalDataHash;
  return toHex(sha3_256(new TextEncoder().encode(input)));
}

/**
 * Content-stable projection of a node for graphId computation.
 * Strips createdAt (time-variant) so equivalent logical content always
 * produces the same graphId regardless of when nodes were created.
 */
function nodeForHashing(node: ProofGraphNode): object {
  const { createdAt: _createdAt, ...rest } = node;
  return rest;
}

export function computeProofGraphId(nodes: ProofGraphNode[], edges: ProofGraphEdge[]): string {
  const sortedNodes = [...nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(nodeForHashing);
  const sortedEdges = [...edges].sort((a, b) => a.id.localeCompare(b.id));
  const input = 'totem-proofgraph' + canonicalJson(sortedNodes) + canonicalJson(sortedEdges);
  return toHex(sha3_256(new TextEncoder().encode(input)));
}

export function recomputeGraphId(graph: { nodes: ProofGraphNode[]; edges: ProofGraphEdge[] }): string {
  return computeProofGraphId(graph.nodes, graph.edges);
}
