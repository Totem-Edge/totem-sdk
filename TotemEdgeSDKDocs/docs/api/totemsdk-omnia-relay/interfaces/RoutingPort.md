[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / RoutingPort

# Interface: RoutingPort

Source of routing topology for the relay client (RFC-034 §6.1). A thin wallet
sees only its own channels, so a host (a self-hosted relay sidecar) or a
gossip feed may inject a fuller graph.

## Methods

### snapshot()

> **snapshot**(): `Iterable`\<`ChannelGraphEdge`\>

Current known directed channel edges (own + announced).

#### Returns

`Iterable`\<`ChannelGraphEdge`\>

***

### subscribe()?

> `optional` **subscribe**(`onChange`): () => `void`

Optional: subscribe to topology changes; returns an unsubscribe fn.

#### Parameters

##### onChange

() => `void`

#### Returns

() => `void`

***

### swaps()?

> `optional` **swaps**(): readonly `SwapAnnouncement`[]

Optional: announced cross-token swaps.

#### Returns

readonly `SwapAnnouncement`[]
