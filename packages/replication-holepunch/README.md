# @totemsdk/replication-holepunch

Holepunch adapters for the runtime-neutral contracts in
`@totemsdk/replication`. The package is optional: install it only when a runtime
has Hypercore/Hyperbee/Corestore available.

- Hypercore → `ReplicatedLog` (single-writer append-only log)
- Hyperbee → `DistributedIndex` (read-mostly index)
- Hyperdrive/Autobase adapters are Phase 2/3 work in RFC-057.

A local append is locally persisted, not remotely acknowledged and not final.
