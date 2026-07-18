/**
 * Serialization helpers for ProofGraph.
 *
 * exportProofGraph:  JSON-stringify the graph for storage or transport.
 * importProofGraph:  parse JSON, validate every node/edge, recompute graphId,
 *                    and throw if verification fails.
 *
 * The graphId guards against silent corruption in transit. Node/edge
 * validation prevents hostile or malformed input from entering the system.
 */

import type { ProofGraph, ProofGraphNode, ProofGraphEdge, ProofGraphNodeType, ProofGraphEdgeType } from './types.js';
import { recomputeGraphId } from './canonical.js';

const VALID_NODE_TYPES: ReadonlySet<string> = new Set([
  'proof', 'identity', 'identity-claim', 'manifest', 'address',
  'subject', 'evidence', 'anchor', 'receipt', 'payment', 'device',
  'service', 'policy', 'custom',
]);

const VALID_EDGE_TYPES: ReadonlySet<string> = new Set([
  'proves', 'issued_by', 'signed_by', 'about', 'references',
  'derived_from', 'supports', 'contradicts', 'supersedes', 'revokes',
  'anchored_to', 'delegates_to', 'controls', 'depends_on',
  'manifests_as', 'conflicts_with',
]);

const MAX_NODES = 10_000;
const MAX_EDGES = 50_000;
const MAX_STRING_LENGTH = 4096;
const MAX_DATA_DEPTH = 10;
const MAX_DATA_KEYS = 256;

/**
 * Validate a single ProofGraphNode.
 * Throws if the node violates structural constraints.
 */
function validateNode(node: unknown, index: number): asserts node is ProofGraphNode {
  if (!node || typeof node !== 'object') {
    throw new Error(`importProofGraph: nodes[${index}] is not an object`);
  }
  const n = node as Record<string, unknown>;
  if (typeof n.id !== 'string' || n.id.length === 0) {
    throw new Error(`importProofGraph: nodes[${index}] missing or empty id`);
  }
  if (typeof n.refId !== 'string' || n.refId.length === 0) {
    throw new Error(`importProofGraph: nodes[${index}] missing or empty refId`);
  }
  if (n.id.length > MAX_STRING_LENGTH) {
    throw new Error(`importProofGraph: nodes[${index}].id exceeds ${MAX_STRING_LENGTH} chars`);
  }
  if (n.refId.length > MAX_STRING_LENGTH) {
    throw new Error(`importProofGraph: nodes[${index}].refId exceeds ${MAX_STRING_LENGTH} chars`);
  }
  if (!VALID_NODE_TYPES.has(String(n.type))) {
    throw new Error(`importProofGraph: nodes[${index}] invalid type "${String(n.type)}"`);
  }
  if (typeof n.createdAt !== 'number' || n.createdAt < 0 || !Number.isFinite(n.createdAt)) {
    throw new Error(`importProofGraph: nodes[${index}] invalid or negative createdAt`);
  }
  if (n.data !== undefined && n.data !== null) {
    if (typeof n.data !== 'object') {
      throw new Error(`importProofGraph: nodes[${index}].data must be an object`);
    }
    const keys = Object.keys(n.data as Record<string, unknown>);
    if (keys.length > MAX_DATA_KEYS) {
      throw new Error(`importProofGraph: nodes[${index}].data exceeds ${MAX_DATA_KEYS} keys`);
    }
    checkDepth(n.data as Record<string, unknown>, 0, MAX_DATA_DEPTH, `nodes[${index}].data`);
  }
}

/**
 * Validate a single ProofGraphEdge.
 * Throws if the edge violates structural constraints.
 */
function validateEdge(edge: unknown, index: number): asserts edge is ProofGraphEdge {
  if (!edge || typeof edge !== 'object') {
    throw new Error(`importProofGraph: edges[${index}] is not an object`);
  }
  const e = edge as Record<string, unknown>;
  if (typeof e.id !== 'string' || e.id.length === 0) {
    throw new Error(`importProofGraph: edges[${index}] missing or empty id`);
  }
  if (typeof e.from !== 'string' || e.from.length === 0) {
    throw new Error(`importProofGraph: edges[${index}] missing or empty from`);
  }
  if (typeof e.to !== 'string' || e.to.length === 0) {
    throw new Error(`importProofGraph: edges[${index}] missing or empty to`);
  }
  if (e.id.length > MAX_STRING_LENGTH || e.from.length > MAX_STRING_LENGTH || e.to.length > MAX_STRING_LENGTH) {
    throw new Error(`importProofGraph: edges[${index}] string field exceeds ${MAX_STRING_LENGTH} chars`);
  }
  if (!VALID_EDGE_TYPES.has(String(e.type))) {
    throw new Error(`importProofGraph: edges[${index}] invalid type "${String(e.type)}"`);
  }
  if (e.proofId !== undefined && typeof e.proofId !== 'string') {
    throw new Error(`importProofGraph: edges[${index}].proofId must be a string`);
  }
  if (e.data !== undefined && e.data !== null) {
    if (typeof e.data !== 'object') {
      throw new Error(`importProofGraph: edges[${index}].data must be an object`);
    }
    checkDepth(e.data as Record<string, unknown>, 0, MAX_DATA_DEPTH, `edges[${index}].data`);
  }
}

/**
 * Recursive depth check on nested data objects to prevent deep-object attacks.
 */
function checkDepth(obj: Record<string, unknown>, depth: number, maxDepth: number, path: string): void {
  if (depth > maxDepth) {
    throw new Error(`importProofGraph: ${path} exceeds max nesting depth of ${maxDepth}`);
  }
  for (const [key, value] of Object.entries(obj)) {
    if (typeof key === 'string' && key.length > MAX_STRING_LENGTH) {
      throw new Error(`importProofGraph: ${path} key exceeds ${MAX_STRING_LENGTH} chars`);
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array)) {
      checkDepth(value as Record<string, unknown>, depth + 1, maxDepth, `${path}.${key}`);
    }
  }
}

/**
 * Serialize a ProofGraph to a JSON string.
 * The stored graphId was computed at mutation time and is included as-is.
 */
export function exportProofGraph(graph: ProofGraph): string {
  return JSON.stringify(graph);
}

/**
 * Deserialize a ProofGraph from a JSON string.
 *
 * Validates every node and edge against structural constraints, then
 * recomputes the graphId from nodes + edges. Throws if any constraint
 * is violated or if the recomputed graphId does not match the stored value.
 *
 * @throws Error if parsing, validation, or graphId verification fails.
 */
export function importProofGraph(json: string): ProofGraph {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`importProofGraph: invalid JSON — ${(err as Error).message}`);
  }

  const graph = parsed as ProofGraph;

  if (!graph || typeof graph !== 'object') {
    throw new Error('importProofGraph: parsed value is not an object');
  }
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error('importProofGraph: missing nodes or edges arrays');
  }

  if (graph.nodes.length > MAX_NODES) {
    throw new Error(`importProofGraph: node count ${graph.nodes.length} exceeds limit ${MAX_NODES}`);
  }
  if (graph.edges.length > MAX_EDGES) {
    throw new Error(`importProofGraph: edge count ${graph.edges.length} exceeds limit ${MAX_EDGES}`);
  }

  // Validate every node and edge
  for (let i = 0; i < graph.nodes.length; i++) {
    validateNode(graph.nodes[i], i);
  }
  for (let i = 0; i < graph.edges.length; i++) {
    validateEdge(graph.edges[i], i);
  }

  // Recompute and verify graphId
  const originalId = typeof graph.graphId === 'string' ? graph.graphId : '';
  const recomputed = recomputeGraphId(graph);

  // If a stored graphId exists, verify it matches
  if (originalId !== '' && recomputed !== originalId) {
    throw new Error(
      `importProofGraph: graphId mismatch — stored="${originalId}" recomputed="${recomputed}"`,
    );
  }

  // Return with graphId set to the recomputed value for consistency
  return { ...graph, graphId: recomputed };
}
