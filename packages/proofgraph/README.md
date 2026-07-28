# @totemsdk/proofgraph

Local deterministic proof relationship graph for Totem Edge — indexes proofs, identities, manifests, anchors, and subjects into a queryable, content-addressed DAG.

No network. No storage. Pure in-memory immutable graph with SHA3-256 content addressing.

## Installation

```bash
npm install @totemsdk/proofgraph
```

## Overview

`@totemsdk/proofgraph` takes `SignedProof` objects (from [`@totemsdk/proof`](https://www.npmjs.com/package/@totemsdk/proof)) and builds a local relationship graph you can query and verify. Every mutation returns a new graph with a recomputed `graphId` — the ID is a deterministic SHA3-256 over node and edge content, so the same logical graph always produces the same ID regardless of when it was built.

Key properties:

- **Immutable** — every add/mutation returns a new `ProofGraph`; originals are never modified
- **Idempotent** — adding the same node or edge twice has no effect (deduplication by content ID)
- **Content-deterministic** — `graphId` excludes `createdAt` timestamps so identical content always hashes identically
- **Interface-only storage** — `ProofGraphStoragePort` is an interface; no concrete adapter ships in this package

## All exports

### Graph construction

| Export | Description |
|--------|-------------|
| `createProofGraph()` | Create an empty graph |
| `setGraphMetadata(graph, metadata)` | Attach mutable metadata; recomputes `graphId` |
| `addProof(graph, signed)` | Add a `SignedProof` with all its linked nodes and edges |
| `addIdentityDocument(graph, doc)` | Add a `TotemIdentityDocument` node |
| `addIdentityClaim(graph, signed)` | Add a `SignedIdentityClaim` with its edge type |
| `addManifest(graph, signed)` | Add a `SignedManifest` with `manifests_as` address edges |
| `addReceiptLike(graph, receipt)` | Add a receipt node; optionally link to a proof |
| `addAnchor(graph, anchor)` | Add a standalone anchor node; optionally link to a proof |
| `addNode(graph, node)` | Low-level: add a pre-built `ProofGraphNode` |
| `addEdge(graph, edge)` | Low-level: add a pre-built `ProofGraphEdge` |
| `buildEdge(type, from, to, contextId?)` | Construct an edge without adding it |

### Query

| Export | Description |
|--------|-------------|
| `findNode(graph, refId)` | Find a node by its `refId` |
| `getProofNodes(graph)` | All nodes of type `'proof'` |
| `findProofsBySubject(graph, subjectId)` | Proofs where the subject matches (via `about` or `proves` edges) |
| `findProofsByIssuer(graph, issuer)` | Proofs issued by a given address |
| `findAnchorsForProof(graph, proofId)` | Anchor nodes linked to a proof via `anchored_to` edges |
| `findRevocations(graph, proofId)` | Proofs that revoke a given proof |
| `findSupersessions(graph, proofId)` | Proofs that supersede a given proof |
| `findConflicts(graph)` | All subject nodes targeted by more than one proof |
| `getEvidenceTrail(graph, proofId)` | Evidence nodes linked to a proof, in insertion order |
| `getProofLineage(graph, proofId)` | Walk `derived_from` chain; returns ancestor nodes (cycle-safe) |
| `resolveCurrentProofSet(graph)` | Active proofs — revoked and superseded proofs are excluded |
| `getManifestsForAddress(graph, address)` | Manifest nodes linked to an address |
| `getEdgesFrom(graph, refId)` | All edges originating from a node |
| `getEdgesTo(graph, refId)` | All edges terminating at a node |
| `getEdgesByType(graph, type)` | All edges of a given type |
| `getEdgesBetween(graph, fromId, toId)` | All edges between two specific nodes |
| `reachableFrom(graph, startId, edgeTypes?)` | BFS reachability from a node, optionally filtered by edge type |

### Verification

| Export | Description |
|--------|-------------|
| `verifyProofGraph(graph)` | Verify all proof nodes; returns `ProofGraphVerifyResult` |
| `verifyGraphProofs(graph)` | Returns `string[]` — IDs of proofs that fail verification |

### Import / Export

| Export | Description |
|--------|-------------|
| `exportProofGraph(graph)` | Serialize to JSON string |
| `importProofGraph(json)` | Deserialize and verify `graphId` integrity — throws on tamper |

### Canonical helpers

| Export | Description |
|--------|-------------|
| `computeNodeId(type, refId, data?)` | Deterministic SHA3-256 node ID |
| `computeEdgeId(type, from, to)` | Deterministic SHA3-256 edge ID |
| `computeProofGraphId(graph)` | SHA3-256 of all node and edge IDs (excludes `createdAt`, `metadata`) |
| `recomputeGraphId(graph)` | Return a new graph with a freshly computed `graphId` |
| `toHex(bytes)` | Uint8Array → lowercase hex (no 0x prefix) |
| `canonicalJson(value)` | Deterministic JSON — sorted keys, no `undefined` |

## Type reference

### `ProofGraph`

```typescript
interface ProofGraph {
  graphId: string;           // SHA3-256 over all node/edge content IDs
  nodes: ProofGraphNode[];
  edges: ProofGraphEdge[];
  createdAt: number;         // Unix ms — excluded from graphId
  metadata?: Record<string, unknown>;  // Also excluded from graphId
}
```

### `ProofGraphNode`

```typescript
interface ProofGraphNode {
  id: string;                // computeNodeId(type, refId, data)
  type: ProofGraphNodeType;
  refId: string;             // External ID (proofId, address, evidenceId, …)
  createdAt: number;         // Unix ms — excluded from graphId hash
  data?: Record<string, unknown>;
}

type ProofGraphNodeType =
  | 'proof' | 'subject' | 'issuer' | 'evidence'
  | 'anchor' | 'manifest' | 'address' | 'identity'
  | 'receipt';
```

### `ProofGraphEdge`

```typescript
interface ProofGraphEdge {
  id: string;                // computeEdgeId(type, from, to)
  type: ProofGraphEdgeType;
  from: string;              // source node refId
  to: string;                // target node refId
  contextId?: string;        // e.g. the proofId that caused this edge
}

type ProofGraphEdgeType =
  | 'issued_by' | 'about' | 'proves' | 'has_evidence'
  | 'anchored_to' | 'revokes' | 'supersedes' | 'delegates_to'
  | 'derived_from' | 'manifests_as' | 'controls' | 'supports';
```

### `ProofGraphVerifyResult`

```typescript
interface ProofGraphVerifyResult {
  valid: boolean;
  invalidProofs: string[];   // proofIds that failed verification
  checkedCount: number;
}
```

### `ReceiptLikeInput` / `AnchorInput`

```typescript
interface ReceiptLikeInput {
  id: string;
  data?: Record<string, unknown>;
  proofId?: string;          // If set, adds a 'supports' edge from receipt → proof
}

interface AnchorInput {
  hash: string;              // Used as the node's refId
  proofId?: string;          // If set, adds an 'anchored_to' edge from proof → anchor
  [key: string]: unknown;    // Additional fields stored as node data
}
```

## Usage

```typescript
import {
  createProofGraph,
  addProof,
  addAnchor,
  verifyProofGraph,
  findProofsBySubject,
  resolveCurrentProofSet,
  exportProofGraph,
  importProofGraph,
} from '@totemsdk/proofgraph';
import { createProof, signProof, createAnchorCommitment } from '@totemsdk/proof';

// 1. Build a signed proof
const unsigned = createProof({
  kind: 'ownership',
  subject: { id: 'totem:subject:asset:nft-001', kind: 'nft' },
  issuer: 'MxROOT...',
});
const signed = signProof(unsigned, seed, keyIndex);

// 2. Build the graph
let graph = createProofGraph();
graph = addProof(graph, signed);

// 3. Add an on-chain anchor
graph = addAnchor(graph, {
  hash: createAnchorCommitment(signed),
  proofId: signed.proofId,
  txId: '0xabc...',
});

// 4. Query
const forAsset = findProofsBySubject(graph, 'totem:subject:asset:nft-001');
console.log('Proofs:', forAsset.length);

const active = resolveCurrentProofSet(graph);
console.log('Active proofs:', active.length);

// 5. Verify all signatures
const result = verifyProofGraph(graph);
console.assert(result.valid, result.invalidProofs);

// 6. Serialize / deserialize (graphId is verified on import)
const json = exportProofGraph(graph);
const restored = importProofGraph(json);
console.assert(restored.graphId === graph.graphId);
```

## Design notes

### Content-deterministic `graphId`

`computeProofGraphId` excludes `node.createdAt` and `graph.metadata` from the hash. Two graphs built at different times from identical proofs will have the same `graphId`. This makes the ID suitable as a stable content address for caching and deduplication.

### Immutable + idempotent mutations

Every function that modifies a graph (`addProof`, `addEdge`, etc.) returns a new `ProofGraph` with a recomputed `graphId`. Calling the same add function twice with the same arguments returns a graph identical to calling it once — duplicate nodes and edges are silently ignored.

### `ProofGraphStoragePort`

This package exports a `ProofGraphStoragePort` interface only. If you need persistent storage, implement the interface in your own adapter:

```typescript
import type { ProofGraphStoragePort, ProofGraph } from '@totemsdk/proofgraph';

class MyStorage implements ProofGraphStoragePort {
  async save(graph: ProofGraph): Promise<void> { /* ... */ }
  async load(graphId: string): Promise<ProofGraph | null> { /* ... */ }
}
```

## Related packages

- [`@totemsdk/proof`](https://www.npmjs.com/package/@totemsdk/proof) — signed proof creation and verification
- [`@totemsdk/proof-integritas`](https://www.npmjs.com/package/@totemsdk/proof-integritas) — Integritas v2 on-chain anchoring
- [`@totemsdk/identity`](https://www.npmjs.com/package/@totemsdk/identity) — identity documents and claims
- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — WOTS signing primitives

## License

MIT
