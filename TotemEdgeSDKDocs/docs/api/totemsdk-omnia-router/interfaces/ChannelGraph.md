[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / ChannelGraph

# Interface: ChannelGraph

In-memory channel graph with a swap announcement index.

A single logical channel may have up to two directed edges (one per
direction of flow, e.g. Alice→Bob and Bob→Alice).  Both edges share the
same `channelId` and are stored together in `edgesByChannel`.

## Properties

### edgesByChannel

> **edgesByChannel**: `Map`\<`string`, [`ChannelGraphEdge`](ChannelGraphEdge.md)[]\>

All directed edges for a channel, keyed by channelId.
Value is an array because a bidirectional channel has two directed edges.

***

### nodeEdges

> **nodeEdges**: `Map`\<`string`, [`ChannelGraphEdge`](ChannelGraphEdge.md)[]\>

Directed edges keyed by sender pubkey

***

### swapIndex

> **swapIndex**: `Map`\<`string`, [`SwapAnnouncement`](SwapAnnouncement.md)[]\>

Swap announcements keyed by `${tokenIn}:${tokenOut}`
