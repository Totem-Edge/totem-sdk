# RFC-057 Phase 2 — Hyperdrive artifacts

Status: **Complete 2026-10-27** — digest-verified Hyperdrive ArtifactStoreBackend + conformance; QVAC verification bridge and interrupted-download coverage.
Parent: [`RFC-057-DISTRIBUTED-STORAGE-AND-REPLICATION.md`](./RFC-057-DISTRIBUTED-STORAGE-AND-REPLICATION.md)

## Landed

- `@totemsdk/replication-holepunch/hyperdrive`:
  - `HyperdriveArtifactBackend` implements `ArtifactStoreBackend`.
  - Paths are derived from `ArtifactRef` (`/<namespace>/<algorithm>/<digest>`)
    and are immutable; existing content is never overwritten.
  - Every read verifies SHA3-256; a mismatch returns `corrupt`, not `not-found`.
  - `put` rejects bytes that do not match the ref digest; capabilities report
    `buffered`, `retention: fixed`, `deletable: false`.
  - Restart/reopen and not-found/corrupt tests.
- Storage conformance harness gained a `digestAware` mode and skips the overwrite
  case for fixed-retention backends; the Hyperdrive backend passes it.

- `downloadModelAsset()` in `replication-holepunch/qvac-artifacts` bridges
  QVAC `downloadAsset()` results into `ArtifactStore`: it verifies SHA3-256
  against the expected `ArtifactRef` **before** `put`, so truncated or
  substituted downloads never become addressable. `verifyModelAssetBytes()` is
  available for read-only checks.
- Proof evidence already flows through `createProofGraphEvidenceStore`, which
  enforces `contentHash === artifact.digest`; no ad-hoc proof artifact paths
  remain in the proof producers.
- Interrupted-download corruption coverage: a partial/tampered payload is
  rejected before write and the store is unchanged.

## Deferred to Phase 4

1. Adopt `downloadModelAsset()` at QVAC call sites (there are no in-repo callers
   today; consumers must opt in).
2. Decide whether Hyperdrive keys/versions expose a separate artifact index.
3. Real-peer cache lifecycle/eviction tests.

Phase 2 gate is met for the library surface; runtime consumers are Phase 4.
