/**
 * @module @totemsdk/proofgraph
 *
 * Local deterministic proof relationship graph for Totem Edge.
 *
 * Indexes SignedProofs, SignedIdentityClaims, SignedManifests, identity
 * documents, and custom evidence nodes into an immutable, queryable DAG
 * keyed by a content-derived graphId. Pure package — no network, no DHT,
 * no blockchain submission, no crypto reimplementation.
 *
 * Usage:
 *   const g0 = createProofGraph();
 *   const g1 = addProof(g0, signedProof);
 *   const result = verifyProofGraph(g1);
 */

export type {
  ProofGraphNodeType,
  ProofGraphEdgeType,
  ProofGraphNode,
  ProofGraphEdge,
  ProofGraph,
  ProofGraphVerifyResult,
  ProofGraphStoragePort,
  ReceiptLikeInput,
  AnchorInput,
} from './types.js';

export {
  toHex,
  canonicalJson,
  computeNodeId,
  computeEdgeId,
  computeProofGraphId,
  recomputeGraphId,
} from './canonical.js'; // canonicalJson / toHex re-exported from @totemsdk/proof

export {
  createProofGraph,
  setGraphMetadata,
  buildEdge,
  addNode,
  addEdge,
  addIdentityDocument,
  addProof,
  addIdentityClaim,
  addManifest,
  addReceiptLike,
  addAnchor,
} from './graph.js';

export {
  findNode,
  getEdgesFrom,
  getEdgesTo,
  getEdgesByType,
  getProofNodes,
  findProofsBySubject,
  findProofsByIssuer,
  findAnchorsForProof,
  findRevocations,
  findSupersessions,
  findConflicts,
  getEvidenceTrail,
  getProofLineage,
  resolveCurrentProofSet,
  getManifestsForAddress,
  getEdgesBetween,
  reachableFrom,
} from './query.js';

export {
  verifyProofGraph,
  verifyGraphProofs,
} from './verify.js';

export {
  exportProofGraph,
  importProofGraph,
} from './io.js';
