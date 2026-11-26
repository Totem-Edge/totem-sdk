[**@totemsdk/replication**](../index.md)

***

[@totemsdk/replication](../index.md) / ReplicaFreshness

# Type Alias: ReplicaFreshness

> **ReplicaFreshness** = `"fresh"` \| `"stale"` \| `"unknown"`

RFC-057 Phase 4 — freshness-aware replicated reads.

A replica never claims to be authoritative. `complete: false` or an expired
observation is surfaced as `stale`; a primary read is used only when the
replica has no value and a primary reader is explicitly supplied. Replica
errors are never silently converted into primary reads.
