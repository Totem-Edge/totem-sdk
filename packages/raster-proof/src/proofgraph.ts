/**
 * Proofgraph integration helpers for @totemsdk/raster-proof.
 *
 * Produces nodes and edges for @totemsdk/proofgraph without storage
 * assumptions. Helpers never mutate a graph directly — callers combine the
 * returned nodes/edges with addNode/addEdge.
 *
 * Note: @totemsdk/proofgraph has no native 'raster' node type, so raster
 * manifests and window proofs map to the generic 'custom' node type (the
 * same approach @totemsdk/location-proof and @totemsdk/spatial-proof use).
 * If a dedicated 'raster' node type is ever wanted, propose it in
 * @totemsdk/proofgraph (do not silently fork the vocabulary).
 */

import { addNode, buildEdge, computeNodeId } from '@totemsdk/proofgraph';
import type { ProofGraph, ProofGraphNode, ProofGraphEdge } from '@totemsdk/proofgraph';
import type { RasterManifest, RasterWindowProof } from './types.js';

/**
 * Build a ProofGraphNode for a raster manifest ('custom' type).
 * Node ID is deterministic: "custom:<rasterId>".
 */
export function rasterManifestToProofGraphNode(manifest: RasterManifest): ProofGraphNode {
  return {
    id: computeNodeId('custom', manifest.rasterId),
    type: 'custom',
    refId: manifest.rasterId,
    data: {
      kind: 'raster-manifest',
      sourceType: manifest.sourceType,
      layerType: manifest.layerType,
      contentHash: manifest.asset.contentHash,
      ...(manifest.asset.merkleRoot ? { merkleRoot: manifest.asset.merkleRoot } : {}),
      ...(manifest.spatial?.spatialObjectId ? { spatialObjectId: manifest.spatial.spatialObjectId } : {}),
      ...(manifest.deviceId ? { deviceId: manifest.deviceId } : {}),
    },
    createdAt: manifest.createdAt,
  };
}

/**
 * Build a ProofGraphNode for a raster window proof ('custom' type).
 * Node ID is deterministic: "custom:<windowProofId>".
 */
export function rasterWindowProofToProofGraphNode(windowProof: RasterWindowProof): ProofGraphNode {
  return {
    id: computeNodeId('custom', windowProof.windowProofId),
    type: 'custom',
    refId: windowProof.windowProofId,
    data: {
      kind: 'raster-window-proof',
      rasterId: windowProof.rasterId,
      merkleRoot: windowProof.merkleRoot,
      chunkIndices: windowProof.chunkIndices,
      hashes: windowProof.chunkHashes,
    },
    createdAt: windowProof.createdAt,
  };
}

/**
 * Build ProofGraphEdges for a raster manifest:
 *   derived_from  raster → each source raster     (when provenance.derivedFrom)
 *   references    raster → spatial object         (when spatial.spatialObjectId)
 *   about         raster → device                 (when deviceId)
 *   about         raster → subject(operator)      (when operatorId)
 *   about         raster → subject(mission)       (when missionId)
 *   references    window proof → raster           (see rasterWindowProofToGraphEdges)
 *
 * The "raster supports proof" edge is created by @totemsdk/proofgraph's
 * addProof when the signed proof is added to the graph — this helper has no
 * proof to link at construction time.
 *
 * Edge IDs are deterministic (content-derived in @totemsdk/proofgraph).
 */
export function rasterManifestToGraphEdges(manifest: RasterManifest): ProofGraphEdge[] {
  const edges: ProofGraphEdge[] = [];

  for (const src of manifest.provenance?.derivedFrom ?? []) {
    edges.push(buildEdge('derived_from', manifest.rasterId, src, manifest.rasterId, {
      kind: 'raster-source',
    }));
  }

  if (manifest.spatial?.spatialObjectId) {
    edges.push(buildEdge('references', manifest.rasterId, manifest.spatial.spatialObjectId, manifest.rasterId, {
      kind: 'spatial-object',
    }));
  }

  if (manifest.deviceId) {
    edges.push(buildEdge('about', manifest.rasterId, manifest.deviceId, manifest.rasterId, { kind: 'device' }));
  }
  if (manifest.operatorId) {
    edges.push(buildEdge('about', manifest.rasterId, manifest.operatorId, manifest.rasterId, { kind: 'operator' }));
  }
  if (manifest.missionId) {
    edges.push(buildEdge('about', manifest.rasterId, manifest.missionId, manifest.rasterId, { kind: 'mission' }));
  }

  return edges;
}

/**
 * Build ProofGraphEdges for a raster window proof:
 *   derived_from  window proof → raster
 */
export function rasterWindowProofToGraphEdges(windowProof: RasterWindowProof): ProofGraphEdge[] {
  return [
    buildEdge('derived_from', windowProof.windowProofId, windowProof.rasterId, windowProof.windowProofId, {
      kind: 'raster-window-proof',
    }),
  ];
}

/**
 * Add a raster manifest as a 'custom' node to a proof graph (immutable —
 * returns a new graph).
 */
export function addRasterManifestToGraph(graph: ProofGraph, manifest: RasterManifest): ProofGraph {
  return addNode(graph, 'custom', manifest.rasterId, {
    kind: 'raster-manifest',
    ...manifest,
  });
}