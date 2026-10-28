# RFC-057 Phase 4 — first production consumers

Status: **Complete 2026-10-27** — proofgraph, pear, edge, manifest, identity, agent/decision/governance audit logs, QVAC artifact bridge, lookup capability discovery and freshness-aware replicas; entity/PWA/omnia wrappers pending.
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

## Additional package integrations

- `proofgraph` replicated evidence adapter (digest re-verified on read).
- `pear` `@totemsdk/pear/replication` factories for Hypercore/Hyperbee/Hyperdrive.
- `edge` replicated device event history and `industrial-action` replicated event sink.
- `manifest` replicated announcement store (signature/sequence verified on replay).
- `identity` replicated claim index (signature verified on write and read).
- `agent-policy`, `decision`, `governance` replicated audit/receipt logs.
- `qvac` `@totemsdk/qvac/artifacts` download → verify → artifact-store bridge.
- `lookup-protocol`/`lookup-node`/`lookup-client` replication capability discovery.
