/**
 * Proof graph mutation functions — all pure, all returning NEW graphs.
 *
 * Immutable pattern: every mutation returns a brand-new ProofGraph with a
 * recomputed graphId. Nodes and edges are deduplicated by ID so adding the
 * same proof twice is idempotent.
 */

import type { SignedProof } from '@totemsdk/proof';
import type { SignedIdentityClaim, TotemIdentityDocument } from '@totemsdk/identity';
import type { SignedManifest } from '@totemsdk/manifest';
import { computeManifestId } from '@totemsdk/manifest';
import type {
  ProofGraph,
  ProofGraphNode,
  ProofGraphEdge,
  ProofGraphEdgeType,
  ProofGraphNodeType,
  ReceiptLikeInput,
  AnchorInput,
} from './types.js';
import { computeNodeId, computeEdgeId, computeProofGraphId } from './canonical.js';

function makeNode(
  type: ProofGraphNodeType,
  refId: string,
  data?: Record<string, unknown>,
): ProofGraphNode {
  return {
    id: computeNodeId(type, refId),
    type,
    refId,
    ...(data !== undefined ? { data } : {}),
    createdAt: Date.now(),
  };
}

function makeEdge(
  type: ProofGraphEdgeType,
  from: string,
  to: string,
  proofId?: string,
  data?: Record<string, unknown>,
): ProofGraphEdge {
  return {
    id: computeEdgeId(type, from, to, proofId, data),
    type,
    from,
    to,
    ...(proofId !== undefined ? { proofId } : {}),
    ...(data !== undefined ? { data } : {}),
  };
}

function mergeNodes(existing: ProofGraphNode[], incoming: ProofGraphNode[]): ProofGraphNode[] {
  const byId = new Map<string, ProofGraphNode>(existing.map((n) => [n.id, n]));
  for (const node of incoming) {
    if (!byId.has(node.id)) {
      byId.set(node.id, node);
    }
  }
  return Array.from(byId.values());
}

function mergeEdges(existing: ProofGraphEdge[], incoming: ProofGraphEdge[]): ProofGraphEdge[] {
  const byId = new Map<string, ProofGraphEdge>(existing.map((e) => [e.id, e]));
  for (const edge of incoming) {
    if (!byId.has(edge.id)) {
      byId.set(edge.id, edge);
    }
  }
  return Array.from(byId.values());
}

function rebuild(
  graph: ProofGraph,
  newNodes: ProofGraphNode[],
  newEdges: ProofGraphEdge[],
): ProofGraph {
  const nodes = mergeNodes(graph.nodes, newNodes);
  const edges = mergeEdges(graph.edges, newEdges);
  return {
    ...graph,
    nodes,
    edges,
    graphId: computeProofGraphId(nodes, edges),
  };
}

/**
 * Create an empty ProofGraph.
 */
export function createProofGraph(metadata?: Record<string, unknown>): ProofGraph {
  const nodes: ProofGraphNode[] = [];
  const edges: ProofGraphEdge[] = [];
  return {
    graphId: computeProofGraphId(nodes, edges),
    nodes,
    edges,
    createdAt: Date.now(),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

/**
 * Attach or replace mutable metadata. Does NOT affect graphId.
 */
export function setGraphMetadata(graph: ProofGraph, metadata: Record<string, unknown>): ProofGraph {
  return { ...graph, metadata };
}

/**
 * Build a ProofGraphEdge with a deterministic ID from its fields.
 * Convenience helper so callers don't need to import computeEdgeId.
 */
export function buildEdge(
  type: ProofGraphEdgeType,
  from: string,
  to: string,
  proofId?: string,
  data?: Record<string, unknown>,
): ProofGraphEdge {
  return makeEdge(type, from, to, proofId, data);
}

/**
 * Add a node directly (type + refId pair). Idempotent — skipped if the node already exists.
 */
export function addNode(
  graph: ProofGraph,
  type: ProofGraphNodeType,
  refId: string,
  data?: Record<string, unknown>,
): ProofGraph {
  return rebuild(graph, [makeNode(type, refId, data)], []);
}

/**
 * Append a ProofGraphEdge and recompute graphId. Idempotent by edge ID.
 * Spec API: addEdge(graph, edge). Use buildEdge() to construct the edge object.
 */
export function addEdge(graph: ProofGraph, edge: ProofGraphEdge): ProofGraph {
  const edges = mergeEdges(graph.edges, [edge]);
  return {
    ...graph,
    edges,
    graphId: computeProofGraphId(graph.nodes, edges),
  };
}

/**
 * Index a TotemIdentityDocument into the graph.
 * Creates an 'identity' node with refId = doc.id.
 */
export function addIdentityDocument(graph: ProofGraph, doc: TotemIdentityDocument): ProofGraph {
  return rebuild(
    graph,
    [makeNode('identity', doc.id, { ...(doc as unknown as Record<string, unknown>) })],
    [],
  );
}

/**
 * Index a SignedProof into the graph.
 *
 * Nodes created:
 *   proof      — proofId (stores the full SignedProof in .data)
 *   identity   — signature.address (issuer key address)
 *   subject    — proof.subject.id
 *   evidence   — ev.id (one per evidence ref)
 *   anchor     — anchor.hash (if present)
 *
 * Edges created (all referencing the proofId):
 *   proves      proof → subject
 *   issued_by   proof → identity (signer)
 *   about       proof → subject
 *   references  proof → evidence (one per evidence ref, in array order)
 *   anchored_to proof → anchor (if present)
 */
export function addProof(graph: ProofGraph, signedProof: SignedProof): ProofGraph {
  const proofNode = makeNode('proof', signedProof.proofId, {
    ...(signedProof as unknown as Record<string, unknown>),
  });
  const identityNode = makeNode('identity', signedProof.signature.address);
  const subjectNode = makeNode('subject', signedProof.subject.id);

  const newNodes: ProofGraphNode[] = [proofNode, identityNode, subjectNode];
  const newEdges: ProofGraphEdge[] = [
    makeEdge('proves', signedProof.proofId, signedProof.subject.id, signedProof.proofId),
    makeEdge('issued_by', signedProof.proofId, signedProof.signature.address, signedProof.proofId),
    makeEdge('about', signedProof.proofId, signedProof.subject.id, signedProof.proofId),
  ];

  if (signedProof.evidence) {
    for (const ev of signedProof.evidence) {
      newNodes.push(makeNode('evidence', ev.id));
      newEdges.push(makeEdge('references', signedProof.proofId, ev.id, signedProof.proofId));
    }
  }

  if (signedProof.anchor) {
    newNodes.push(makeNode('anchor', signedProof.anchor.hash));
    newEdges.push(
      makeEdge('anchored_to', signedProof.proofId, signedProof.anchor.hash, signedProof.proofId),
    );
  }

  return rebuild(graph, newNodes, newEdges);
}

/**
 * Index a SignedIdentityClaim into the graph.
 *
 * Nodes created:
 *   identity-claim — claim.id (stores the full signed claim in .data)
 *   address        — issuer address
 *   address/identity — target address (for delegates_to / rotates_to / revokes)
 *
 * Edges created based on claim.type:
 *   all types    → issued_by  (claim-node → issuer address)
 *   delegates_to → delegates_to edge (claim-node → delegated address)
 *   revokes      → revokes edge      (claim-node → subject identity)
 *   rotates_to   → controls edge     (claim-node → new address)
 */
export function addIdentityClaim(graph: ProofGraph, signedClaim: SignedIdentityClaim): ProofGraph {
  const { claim } = signedClaim;
  const claimNode = makeNode('identity-claim', claim.id, {
    ...(signedClaim as unknown as Record<string, unknown>),
  });
  const issuerNode = makeNode('address', claim.issuer);

  const newNodes: ProofGraphNode[] = [claimNode, issuerNode];
  const newEdges: ProofGraphEdge[] = [
    makeEdge('issued_by', claim.id, claim.issuer),
  ];

  if (claim.type === 'delegates_to') {
    newNodes.push(makeNode('address', claim.object));
    newEdges.push(makeEdge('delegates_to', claim.id, claim.object));
  } else if (claim.type === 'revokes') {
    newNodes.push(makeNode('identity', claim.subject));
    newEdges.push(makeEdge('revokes', claim.id, claim.subject));
  } else if (claim.type === 'rotates_to') {
    newNodes.push(makeNode('address', claim.object));
    newEdges.push(makeEdge('controls', claim.id, claim.object));
  }

  return rebuild(graph, newNodes, newEdges);
}

/**
 * Resolve the author address from a manifest based on its type.
 * AppManifest / DAppManifest → authorAddress
 * CapabilityManifest         → agentAddress
 * EdgeServiceManifest        → operatorAddress
 * Falls back to signedManifest.authorAddress if the manifest type is unknown.
 */
function resolveManifestAddress(signedManifest: SignedManifest): string {
  const m = signedManifest.manifest as unknown as Record<string, unknown>;
  if (m['type'] === 'capability' && typeof m['agentAddress'] === 'string') {
    return m['agentAddress'];
  }
  if (m['type'] === 'edge-service' && typeof m['operatorAddress'] === 'string') {
    return m['operatorAddress'];
  }
  if (typeof m['authorAddress'] === 'string') {
    return m['authorAddress'];
  }
  return signedManifest.authorAddress;
}

/**
 * Index a SignedManifest into the graph.
 *
 * Nodes created:
 *   manifest — computed manifest ID (stores manifest content in .data)
 *   address  — resolved author/agent/operator address
 *
 * Edge created:
 *   manifests_as  manifest → address
 */
export function addManifest(graph: ProofGraph, signedManifest: SignedManifest): ProofGraph {
  const manifestId = computeManifestId(signedManifest.manifest);
  const address = resolveManifestAddress(signedManifest);
  const manifestNode = makeNode('manifest', manifestId, {
    ...(signedManifest as unknown as Record<string, unknown>),
  });
  const addressNode = makeNode('address', address);

  return rebuild(graph, [manifestNode, addressNode], [
    makeEdge('manifests_as', manifestId, address),
  ]);
}

/**
 * Add a receipt-like node (payment, subscription, claim receipt) to the graph.
 * If receipt.proofId is set, adds a 'supports' edge from the receipt to that proof.
 */
export function addReceiptLike(
  graph: ProofGraph,
  receipt: ReceiptLikeInput,
): ProofGraph {
  const { id, data, proofId } = receipt;
  const receiptNode = makeNode('receipt', id, data);
  const newEdges: ProofGraphEdge[] = [];
  if (proofId !== undefined) {
    newEdges.push(makeEdge('supports', id, proofId, proofId));
  }
  return rebuild(graph, [receiptNode], newEdges);
}

/**
 * Add a standalone anchor node. If anchor.proofId is set, adds an 'anchored_to'
 * edge from the proof to this anchor.
 */
export function addAnchor(
  graph: ProofGraph,
  anchor: AnchorInput,
): ProofGraph {
  const { hash, proofId, ...rest } = anchor;
  const nodeData: Record<string, unknown> = { ...rest };
  const anchorNode = makeNode('anchor', hash, Object.keys(nodeData).length > 0 ? nodeData : undefined);
  const newEdges: ProofGraphEdge[] = [];
  if (proofId !== undefined) {
    newEdges.push(makeEdge('anchored_to', proofId, hash, proofId));
  }
  return rebuild(graph, [anchorNode], newEdges);
}
