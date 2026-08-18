/**
 * Proofgraph integration helpers.
 *
 * These helpers produce nodes and edges for @totemsdk/proofgraph without
 * making storage assumptions. They never mutate a graph directly — callers
 * combine the returned nodes/edges with addNode/addEdge, or use the
 * convenience helpers that delegate to @totemsdk/proofgraph's immutable
 * addNode/addProof functions.
 */

import type { SignedProof } from '@totemsdk/proof';
import { addNode, addProof, buildEdge, computeNodeId } from '@totemsdk/proofgraph';
import type { ProofGraph, ProofGraphNode, ProofGraphEdge } from '@totemsdk/proofgraph';
import type { LocationClaim } from './types.js';

/**
 * Build a ProofGraphNode for a location claim.
 *
 * Uses the 'custom' node type (no native proofgraph node type fits a
 * location claim). Node ID is deterministic: "custom:<claimId>".
 */
export function locationClaimToProofGraphNode(claim: LocationClaim): ProofGraphNode {
  return {
    id: computeNodeId('custom', claim.claimId),
    type: 'custom',
    refId: claim.claimId,
    data: { ...claim },
    createdAt: Date.now(),
  };
}

/**
 * Build ProofGraphEdges for a signed location proof:
 *   about       proof → subject
 *   references  proof → each evidence ref
 *   supports    each evidence ref → proof
 *
 * Edge IDs are deterministic (content-derived in @totemsdk/proofgraph).
 */
export function locationProofToGraphEdges(signed: SignedProof): ProofGraphEdge[] {
  const edges: ProofGraphEdge[] = [
    buildEdge('about', signed.proofId, signed.subject.id, signed.proofId),
  ];
  for (const ev of signed.evidence ?? []) {
    edges.push(buildEdge('references', signed.proofId, ev.id, signed.proofId));
    edges.push(buildEdge('supports', ev.id, signed.proofId, signed.proofId));
  }
  return edges;
}

/**
 * Add a location claim as a 'custom' node to a proof graph (immutable —
 * returns a new graph).
 */
export function addLocationClaimToGraph(graph: ProofGraph, claim: LocationClaim): ProofGraph {
  return addNode(graph, 'custom', claim.claimId, { ...claim });
}

/**
 * Index a signed location proof into a proof graph (immutable — returns a
 * new graph). Delegates to @totemsdk/proofgraph's addProof, which creates
 * the proof / identity / subject / evidence nodes and proves / issued_by /
 * about / references edges.
 */
export function addLocationProofToGraph(graph: ProofGraph, signed: SignedProof): ProofGraph {
  return addProof(graph, signed);
}
