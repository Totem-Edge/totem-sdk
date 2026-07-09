/**
 * Serialization helpers for ProofGraph.
 *
 * exportProofGraph:  JSON-stringify the graph for storage or transport.
 * importProofGraph:  parse JSON, recompute graphId, throw if it doesn't match.
 *
 * The graphId guards against silent corruption in transit.
 */

import type { ProofGraph } from './types.js';
import { recomputeGraphId } from './canonical.js';

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
 * Recomputes the graphId from nodes + edges. Throws if the recomputed value
 * does not match the stored graphId — indicates tampering or data corruption.
 *
 * @throws Error if graphId verification fails.
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

  const recomputed = recomputeGraphId(graph);
  if (recomputed !== graph.graphId) {
    throw new Error(
      `importProofGraph: graphId mismatch — stored="${graph.graphId}" recomputed="${recomputed}"`,
    );
  }

  return graph;
}
