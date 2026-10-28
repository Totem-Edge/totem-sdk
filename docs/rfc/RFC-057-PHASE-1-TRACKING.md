# RFC-057 Phase 1 — Replicated logs and indexes

Status: **Phase 1 complete 2026-10-27** — contracts + Hypercore log + Hyperbee index with real two-peer/restart tests.
Parent: [`RFC-057-DISTRIBUTED-STORAGE-AND-REPLICATION.md`](./RFC-057-DISTRIBUTED-STORAGE-AND-REPLICATION.md)

## Landed

| Component | Evidence |
|---|---|
| `@totemsdk/replication` contracts | `ReplicationStatus`, `DistributedCapabilities`, `ReplicatedLog`, `DistributedIndex`, `CollaborativeStore`, dataset descriptors, codec encode/decode, checkpoints |
| Dataset versioning | Unknown `datasetVersion`/`codecVersion` rejected; records carry `datasetId`/`datasetVersion`; versioned Totem codec (bigint/bytes) |
| Hypercore log adapter | `@totemsdk/replication-holepunch/hypercore`: append, `readSince` cursor, restart recovery, real two-peer replication |
| Hyperbee read index | `@totemsdk/replication-holepunch/hyperbee`: get/list, codec values, restart and real two-peer replication |
| Codec compatibility | `@totemsdk/pear` `BareKVStore` already uses the shared codec (Phase 0 D7) |

## Gate evidence

- `pnpm --filter @totemsdk/replication test` (3 tests)
- `pnpm --filter @totemsdk/replication-holepunch test` (5 tests; real Hypercore/Hyperbee)
- Single-writer durability, restart recovery, cursor semantics, version rejection,
  sparse replication and two-peer convergence are covered.

## Not in Phase 1

- Hyperdrive artifact backend (Phase 2)
- Autobase collaborative state (Phase 3)
- Proofgraph/lookup/edge consumers (Phase 4)
- Relay fallback, quotas, encryption and ARM/Bare deployment hardening (Phase 5)
