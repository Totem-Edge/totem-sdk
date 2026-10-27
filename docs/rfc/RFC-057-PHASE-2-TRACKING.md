# RFC-057 Phase 2 — Hyperdrive artifacts

Status: **partial** — Hyperdrive `ArtifactStoreBackend` landed; consumer migration
and interrupted-download coverage remain.
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

## Pending

1. Migrate/ bridge QVAC `downloadAsset({ hyperdriveKey })` to the shared
   `ArtifactStoreBackend` and verify model bytes against the digest.
2. Publish proof artifacts (`location-proof`, `spatial-proof`, `raster-proof`)
   through `ArtifactStore`, not ad-hoc paths.
3. Interrupted-download/cache-lifecycle tests with a real Hyperdrive peer.
4. Decide whether Hyperdrive keys/versions expose a separate artifact index.

Gate is not met until (1)–(3) are tested.
