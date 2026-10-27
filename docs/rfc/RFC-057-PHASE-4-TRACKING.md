# RFC-057 Phase 4 — first production consumers

Status: **complete at the library boundary** — proofgraph evidence, device event
history, manifests, agent receipts and freshness-aware lookup replicas landed.
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

## Completion evidence

- `DeviceEventHistory` validates device/event ids and timestamps over a
  `ReplicatedLog`; `AgentReceiptLog` does the same for receipts.
- `ReplicatedManifestStore` stores versioned manifests with a body digest and
  rejects corruption on read; `publishManifestArtifact` keeps large bodies in
  `ArtifactStore`.
- `readReplicated()` in `@totemsdk/replication` returns explicit
  `source`/`freshness`/`complete`; incomplete or expired replicas are `stale`,
  and replica errors are never hidden by a primary read.
- `LookupClientReadReplica` applies the same contract to `getCoins()` and
  `getTip()`.
- Wiring: `LookupClientConfig.replica` / `replicaMaxAgeMs`; concrete
  `LookupClient.getCoinsReplicated()` / `getTipReplicated()`; and
  `LookupClientProvider.getCoinsWithFreshness()` / `getTipWithFreshness()`.
- Replicated proofgraph evidence network (Phase 4 start) remains.
- Tests: 32 in `replication-holepunch`, 36 in `lookup-client`, 7 in
  `replication`.

## Remaining integration

- Replication capability announcements in `lookup-protocol`.
- Optional `proof-integritas` checkpoint anchoring and governed `edge`
  replication actions.
- Multi-peer end-to-end proofgraph flow over Hyperdrive/Autobase.
