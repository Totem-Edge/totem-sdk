[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeRuntimePorts

# Interface: EdgeRuntimePorts

## Properties

### identity?

> `optional` **identity?**: [`EdgeIdentityPort`](EdgeIdentityPort.md)

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

### stream?

> `optional` **stream?**: [`EdgeStreamPort`](EdgeStreamPort.md)

Bidirectional byte-stream transport (WebSocket, Hyperswarm, WebRTC, stdio).
