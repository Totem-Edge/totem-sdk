[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeRuntimePorts

# Interface: EdgeRuntimePorts

## Properties

### artifacts?

> `optional` **artifacts?**: `ArtifactStore`

RFC-007 Amendment A: optional artifact byte store. Separate from `storage`
(bytes vs. metadata); required when a feature declares `needsArtifacts`.

***

### decision?

> `optional` **decision?**: [`EdgeDecisionPort`](EdgeDecisionPort.md)

Optional bounded decision surface — a sibling of intelligence, not an
intelligence domain. Host implementations via `createEdgeDecisionPort`
from @totemsdk/decision.

***

### identity?

> `optional` **identity?**: [`EdgeIdentityPort`](EdgeIdentityPort.md)

***

### intelligence?

> `optional` **intelligence?**: [`EdgeIntelligencePort`](EdgeIntelligencePort.md)

Optional local intelligence/inference surface.

***

### keyLease?

> `optional` **keyLease?**: [`EdgeKeyLeasePort`](EdgeKeyLeasePort.md)

WOTS key-lease coordination — required before any signing operation.

***

### liquidity?

> `optional` **liquidity?**: [`EdgeLiquidityPort`](EdgeLiquidityPort.md)

***

### location?

> `optional` **location?**: [`EdgeLocationPort`](EdgeLocationPort.md)

***

### lookup?

> `optional` **lookup?**: [`EdgeLookupPort`](EdgeLookupPort.md)

***

### manifest?

> `optional` **manifest?**: [`EdgeManifestPort`](EdgeManifestPort.md)

***

### omnia?

> `optional` **omnia?**: [`EdgeOmniaPort`](EdgeOmniaPort.md)

***

### payment?

> `optional` **payment?**: [`EdgePaymentPort`](EdgePaymentPort.md)

***

### policy?

> `optional` **policy?**: [`EdgePolicyPort`](EdgePolicyPort.md)

***

### proof?

> `optional` **proof?**: [`EdgeProofPort`](EdgeProofPort.md)

***

### pubsub?

> `optional` **pubsub?**: [`EdgePubSubPort`](EdgePubSubPort.md)

Publish-subscribe transport (MQTT-compatible, protocol-agnostic).

***

### storage?

> `optional` **storage?**: `StorageAdapterWithCapabilities`

RFC-007 Amendment A: optional transactional KV substrate. Required when a
configured feature declares `durable`/`needsArtifacts`; validated by
`assertPersistence()` at construction.

***

### stream?

> `optional` **stream?**: [`EdgeStreamPort`](EdgeStreamPort.md)

Bidirectional byte-stream transport (WebSocket, Hyperswarm, WebRTC, stdio).
