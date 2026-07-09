/**
 * @totemsdk/proofgraph — Type definitions
 *
 * Pure schema — no network, no DHT, no blockchain submission, no crypto.
 */

export type ProofGraphNodeType =
  | 'proof'
  | 'identity'
  | 'identity-claim'
  | 'manifest'
  | 'address'
  | 'subject'
  | 'evidence'
  | 'anchor'
  | 'receipt'
  | 'payment'
  | 'device'
  | 'service'
  | 'policy'
  | 'custom';

export type ProofGraphEdgeType =
  | 'proves'
  | 'issued_by'
  | 'signed_by'
  | 'about'
  | 'references'
  | 'derived_from'
  | 'supports'
  | 'contradicts'
  | 'supersedes'
  | 'revokes'
  | 'anchored_to'
  | 'delegates_to'
  | 'controls'
  | 'depends_on'
  | 'manifests_as'
  | 'conflicts_with';

export interface ProofGraphNode {
  id: string;
  type: ProofGraphNodeType;
  refId: string;
  data?: Record<string, unknown>;
  createdAt: number;
}

export interface ProofGraphEdge {
  id: string;
  type: ProofGraphEdgeType;
  from: string;
  to: string;
  proofId?: string;
  data?: Record<string, unknown>;
}

export interface ProofGraph {
  graphId: string;
  nodes: ProofGraphNode[];
  edges: ProofGraphEdge[];
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface ProofGraphVerifyResult {
  valid: boolean;
  invalidProofs: string[];
  reason?: string;
}

/**
 * Input object for addReceiptLike.
 */
export interface ReceiptLikeInput {
  id: string;
  data?: Record<string, unknown>;
  proofId?: string;
}

/**
 * Input object for addAnchor.
 */
export interface AnchorInput {
  hash: string;
  provider?: string;
  txId?: string;
  confirmedAt?: number;
  metadata?: Record<string, unknown>;
  proofId?: string;
}

/**
 * Storage port — interface only, no concrete implementation in this package.
 * Adapters (SQLite, LevelDB, in-memory) live in consumer packages.
 */
export interface ProofGraphStoragePort {
  save(graph: ProofGraph): Promise<void>;
  load(graphId: string): Promise<ProofGraph | null>;
  findByNodeId(id: string): Promise<ProofGraph | null>;
}
