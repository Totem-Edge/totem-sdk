/**
 * Proofgraph integration helpers for @totemsdk/spatial-proof.
 *
 * Produces nodes and edges for @totemsdk/proofgraph without storage
 * assumptions. Helpers never mutate a graph directly — callers combine the
 * returned nodes/edges with addNode/addEdge.
 *
 * Note: @totemsdk/proofgraph has no native 'spatial' node type, so spatial
 * objects and relation claims are mapped to the generic 'custom' node type
 * (the same approach @totemsdk/location-proof uses). If a dedicated
 * 'spatial-object' / 'spatial-relation' node type is ever wanted, propose it
 * in @totemsdk/proofgraph (do not silently fork the vocabulary).
 */

import { addNode, buildEdge, computeNodeId } from '@totemsdk/proofgraph';
import type { ProofGraph, ProofGraphNode, ProofGraphEdge } from '@totemsdk/proofgraph';
import { computeGeometryHash } from './canonical.js';
import type { SpatialObject, SpatialRelationClaim } from './types.js';

/**
 * Build a ProofGraphNode for a spatial object.
 *
 * Uses the 'custom' node type (no native proofgraph node type fits a spatial
 * object). Node ID is deterministic: "custom:<spatialId>".
 */
export function spatialObjectToProofGraphNode(obj: SpatialObject): ProofGraphNode {
  return {
    id: computeNodeId('custom', obj.spatialId),
    type: 'custom',
    refId: obj.spatialId,
    data: {
      kind: 'spatial-object',
      spatialKind: obj.kind,
      geometryHash: computeGeometryHash(obj.geometry),
      ...(obj.name !== undefined ? { name: obj.name } : {}),
      ...(obj.crs !== undefined ? { crs: obj.crs } : {}),
    },
    createdAt: Date.now(),
  };
}

/**
 * Build a ProofGraphNode for a spatial relation claim.
 *
 * Uses the 'custom' node type. Node ID is deterministic: "custom:<relationId>".
 */
export function spatialRelationToProofGraphNode(claim: SpatialRelationClaim): ProofGraphNode {
  return {
    id: computeNodeId('custom', claim.relationId),
    type: 'custom',
    refId: claim.relationId,
    data: {
      kind: 'spatial-relation',
      subjectId: claim.subjectId,
      spatialObjectId: claim.spatialObjectId,
      relation: claim.relation,
      matched: claim.result.matched,
    },
    createdAt: Date.now(),
  };
}

/**
 * Build ProofGraphEdges for a spatial relation claim:
 *   about       relation → subject
 *   references  relation → spatial object
 *   derived_from relation → location claim (when present)
 *   references  relation → subject proof (when present)
 *   references  relation → raster manifest (when present)
 *
 * Edge IDs are deterministic (content-derived in @totemsdk/proofgraph).
 */
export function spatialRelationToGraphEdges(claim: SpatialRelationClaim): ProofGraphEdge[] {
  const edges: ProofGraphEdge[] = [
    buildEdge('about', claim.relationId, claim.subjectId, claim.relationId),
    buildEdge('references', claim.relationId, claim.spatialObjectId, claim.relationId),
  ];

  if (claim.inputs.locationClaimId) {
    edges.push(buildEdge('derived_from', claim.relationId, claim.inputs.locationClaimId, claim.relationId));
  }
  if (claim.inputs.subjectProofId) {
    edges.push(buildEdge('references', claim.relationId, claim.inputs.subjectProofId, claim.relationId));
  }
  if (claim.inputs.rasterManifestId) {
    edges.push(buildEdge('references', claim.relationId, claim.inputs.rasterManifestId, claim.relationId));
  }

  return edges;
}

/**
 * Add a spatial relation claim as a 'custom' node to a proof graph (immutable
 * — returns a new graph).
 */
export function addSpatialRelationToGraph(
  graph: ProofGraph,
  claim: SpatialRelationClaim,
): ProofGraph {
  return addNode(graph, 'custom', claim.relationId, {
    kind: 'spatial-relation',
    ...claim,
  });
}