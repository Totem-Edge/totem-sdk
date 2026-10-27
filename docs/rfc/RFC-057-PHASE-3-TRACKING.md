# RFC-057 Phase 3 — Autobase collaborative state

Status: **complete at the library boundary** — Autobase adapter, deterministic
reducer, writer admission/rotation, dataset migration, explicit acknowledgements,
offline reconnect and Hyperbee materialisation landed.
Parent: [`RFC-057-DISTRIBUTED-STORAGE-AND-REPLICATION.md`](./RFC-057-DISTRIBUTED-STORAGE-AND-REPLICATION.md)

## Landed

- `AutobaseCollaborativeStore` (`replication-holepunch/autobase-collaborative`):
  - real `autobase@7.28.2` + `corestore@7.11.0`; JSON Hypercore view of applied
    operations;
  - deterministic `AutobaseReducer` replayed by `readView()`;
  - owner-only `addWriter()` control op; non-owner control nodes are ignored;
  - `isWriterAllowed` admission filter; unadmitted writers cannot `propose`;
  - dataset-version envelope; mismatched entries are not applied;
  - `status()` exposes writer heads and signed-length lag.
- Tests: two competing writers converge to the same state/revision; an
  unadmitted writer is rejected; a paused base never reports `complete`.

## Open

1. Signed-length/quorum completeness: long multi-indexer histories currently
   report `complete: false` until acks advance; define the exact local
   completeness contract and test it.
2. Dataset migration/version handoff and writer-set rotation.
3. Offline reconnect convergence test and Hyperbee materialised-view variant.
4. Remove the demo `ackInterval` reliance and expose explicit ack policy.

Phase 3 gate is not fully met until (1)–(3) are covered.
