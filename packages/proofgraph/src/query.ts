/**
 * Query helpers for ProofGraph — pure read-only utilities.
 *
 * All functions receive a ProofGraph and return data without mutating the graph.
 * Function names match the @totemsdk/proofgraph public API spec exactly.
 */

import type { ProofGraph, ProofGraphNode, ProofGraphEdge, ProofGraphEdgeType } from './types.js';

/**
 * Find a node by its composed node ID (type:refId) or by refId alone.
 */
export function findNode(graph: ProofGraph, id: string): ProofGraphNode | undefined {
  return graph.nodes.find((n) => n.id === id || n.refId === id);
}

/**
 * Return all outgoing edges from a node (identified by node ID or refId).
 */
export function getEdgesFrom(graph: ProofGraph, nodeIdOrRefId: string): ProofGraphEdge[] {
  const node = findNode(graph, nodeIdOrRefId);
  if (!node) return [];
  return graph.edges.filter((e) => e.from === node.refId);
}

/**
 * Return all incoming edges to a node (identified by node ID or refId).
 */
export function getEdgesTo(graph: ProofGraph, nodeIdOrRefId: string): ProofGraphEdge[] {
  const node = findNode(graph, nodeIdOrRefId);
  if (!node) return [];
  return graph.edges.filter((e) => e.to === node.refId);
}

/**
 * Return all edges of a given type.
 */
export function getEdgesByType(graph: ProofGraph, type: ProofGraphEdgeType): ProofGraphEdge[] {
  return graph.edges.filter((e) => e.type === type);
}

/**
 * Return all proof nodes in the graph.
 */
export function getProofNodes(graph: ProofGraph): ProofGraphNode[] {
  return graph.nodes.filter((n) => n.type === 'proof');
}

/**
 * Find all 'proof' nodes connected to a subject via 'about' OR 'proves' edges.
 */
export function findProofsBySubject(graph: ProofGraph, subjectId: string): ProofGraphNode[] {
  const relevantEdges = graph.edges.filter(
    (e) => (e.type === 'about' || e.type === 'proves') && e.to === subjectId,
  );
  const proofRefIds = new Set(relevantEdges.map((e) => e.from));
  return graph.nodes.filter((n) => proofRefIds.has(n.refId) && n.type === 'proof');
}

/**
 * Find all 'proof' nodes issued by a given address (via 'issued_by' edges).
 */
export function findProofsByIssuer(graph: ProofGraph, issuerId: string): ProofGraphNode[] {
  const issuedEdges = graph.edges.filter(
    (e) => e.type === 'issued_by' && e.to === issuerId,
  );
  const proofRefIds = new Set(issuedEdges.map((e) => e.from));
  return graph.nodes.filter((n) => proofRefIds.has(n.refId) && n.type === 'proof');
}

/**
 * Find all 'anchor' nodes linked to a proof via 'anchored_to' edges.
 */
export function findAnchorsForProof(graph: ProofGraph, proofId: string): ProofGraphNode[] {
  const anchoredEdges = graph.edges.filter(
    (e) => e.type === 'anchored_to' && e.from === proofId,
  );
  const anchorRefIds = new Set(anchoredEdges.map((e) => e.to));
  return graph.nodes.filter((n) => anchorRefIds.has(n.refId) && n.type === 'anchor');
}

/**
 * Find all 'revokes' edges whose target is the given proof node.
 */
export function findRevocations(graph: ProofGraph, proofId: string): ProofGraphEdge[] {
  return graph.edges.filter((e) => e.type === 'revokes' && e.to === proofId);
}

/**
 * Find all 'supersedes' edges whose target is the given proof node.
 */
export function findSupersessions(graph: ProofGraph, proofId: string): ProofGraphEdge[] {
  return graph.edges.filter((e) => e.type === 'supersedes' && e.to === proofId);
}

/**
 * Find all 'conflicts_with' edges involving the given proof node (in either direction).
 */
export function findConflicts(graph: ProofGraph, proofId: string): ProofGraphEdge[] {
  return graph.edges.filter(
    (e) =>
      e.type === 'conflicts_with' &&
      (e.from === proofId || e.to === proofId),
  );
}

/**
 * Traverse 'references' edges from a proof to its evidence nodes.
 * Returns nodes in insertion order (the order edges were added, which matches
 * the original evidence array order from addProof).
 */
export function getEvidenceTrail(graph: ProofGraph, proofId: string): ProofGraphNode[] {
  const refEdges = graph.edges.filter(
    (e) => e.type === 'references' && e.from === proofId,
  );
  return refEdges
    .map((e) => graph.nodes.find((n) => n.refId === e.to && n.type === 'evidence'))
    .filter((n): n is ProofGraphNode => n !== undefined);
}

/**
 * Recursively traverse 'derived_from' edges from a proof node.
 * Returns the ordered chain of ancestor proof nodes (closest ancestor first).
 * Terminates on cycle detection.
 */
export function getProofLineage(
  graph: ProofGraph,
  proofId: string,
  _visited: Set<string> = new Set(),
): ProofGraphNode[] {
  if (_visited.has(proofId)) return [];
  _visited.add(proofId);

  const derivedEdges = graph.edges.filter(
    (e) => e.type === 'derived_from' && e.from === proofId,
  );

  const result: ProofGraphNode[] = [];
  for (const edge of derivedEdges) {
    const node = graph.nodes.find((n) => n.refId === edge.to);
    if (node) {
      result.push(node);
      result.push(...getProofLineage(graph, edge.to, _visited));
    }
  }
  return result;
}

/**
 * Return all proof nodes that are NOT the target of any 'revokes' or 'supersedes' edge.
 * These are the current / active proofs in the graph.
 */
export function resolveCurrentProofSet(graph: ProofGraph): ProofGraphNode[] {
  const supersededOrRevoked = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.type === 'revokes' || edge.type === 'supersedes') {
      supersededOrRevoked.add(edge.to);
    }
  }
  return graph.nodes.filter(
    (n) => n.type === 'proof' && !supersededOrRevoked.has(n.refId),
  );
}

/**
 * Return all manifest nodes linked to a given address via 'manifests_as' edges.
 */
export function getManifestsForAddress(graph: ProofGraph, address: string): ProofGraphNode[] {
  const manifestEdges = graph.edges.filter(
    (e) => e.type === 'manifests_as' && e.to === address,
  );
  const manifestRefIds = new Set(manifestEdges.map((e) => e.from));
  return graph.nodes.filter((n) => manifestRefIds.has(n.refId) && n.type === 'manifest');
}

/**
 * Return all edges between two nodes (in either direction).
 */
export function getEdgesBetween(
  graph: ProofGraph,
  refIdA: string,
  refIdB: string,
): ProofGraphEdge[] {
  return graph.edges.filter(
    (e) =>
      (e.from === refIdA && e.to === refIdB) ||
      (e.from === refIdB && e.to === refIdA),
  );
}

/**
 * Return the set of all node refIds reachable from a given node via directed edges.
 * Includes the start node itself.
 */
export function reachableFrom(
  graph: ProofGraph,
  startRefId: string,
  _visited: Set<string> = new Set(),
): Set<string> {
  if (_visited.has(startRefId)) return _visited;
  _visited.add(startRefId);
  const outgoing = graph.edges.filter((e) => e.from === startRefId);
  for (const edge of outgoing) {
    reachableFrom(graph, edge.to, _visited);
  }
  return _visited;
}
