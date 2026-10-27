# RFC-057 Phase 4 — first production consumers

Status: **partial** — replicated proofgraph evidence network landed; device
histories, manifests, receipts and lookup replicas remain.
Parent: [`RFC-057-DISTRIBUTED-STORAGE-AND-REPLICATION.md`](./RFC-057-DISTRIBUTED-STORAGE-AND-REPLICATION.md)

## Landed

- `createReplicatedEvidenceNetwork` (`replication-holepunch`):
  - stores proofgraph evidence bytes in the digest-verified `ArtifactStore`;
  - indexes `nodeId -> ArtifactRef` through a replicated index port;
  - re-verifies the artifact digest on every read (`corrupt` is never
    `not-found`);
  - rejects a claim commitment that does not equal `sha3(bytes)` before indexing.
- Tests: store/index/re-read with independent verification; commitment mismatch
  rejected; substituted artifact reported `corrupt`.

## Open

1. Device event histories and replicated manifests/receipts.
2. `lookup-client`/`chain-provider`/`realtime` read replicas with explicit
   freshness/`complete`; never silent stale fallback.
3. Replication capability announcements in `lookup-protocol`, optional
   `proof-integritas` checkpoint anchoring, and governed `edge` replication
   actions.
4. End-to-end multi-peer proofgraph flow over Hyperdrive/Autobase.

Phase 4 gate is not met until (2) and (4) are covered.
