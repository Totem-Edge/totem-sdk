[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / ObservationDomain

# Type Alias: ObservationDomain

> **ObservationDomain** = `"node"` \| `"channel"` \| `"funding"` \| `"payment"` \| `"settlement"` \| `"factory"` \| `"vtxo"` \| `"pool"` \| `"splice"` \| `"transport"` \| `"operation"` \| `"command"`

Omnia observation events (RFC-0011 Amendment A / RFC-048).

One event is a durable, replayable record of a single domain transition. It is
intentionally richer than `AnalyticsEvent`: it carries identity, correlation,
exact values, chain/evidence refs and a compact before/after diff so a
consumer (the canary observer, an explorer, an agent) can reconstruct state
without guessing or polling.

Money is always an exact string (atoms). Signatures/seeds/preimages are never
emitted — only hashes/indices.
