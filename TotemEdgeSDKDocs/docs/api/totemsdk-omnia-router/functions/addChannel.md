[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / addChannel

# Function: addChannel()

> **addChannel**(`graph`, `edge`): `void`

Add a directed channel edge to the graph.

A single logical channel between two parties has two directed edges — one
per direction of flow.  Both may be added independently using the same
`channelId` because they are keyed by `(channelId, from)`.  Calling
`addChannel` twice with the same `(channelId, from)` replaces the first
entry (balance update semantics).

## Parameters

### graph

[`ChannelGraph`](../interfaces/ChannelGraph.md)

### edge

[`ChannelGraphEdge`](../interfaces/ChannelGraphEdge.md)

## Returns

`void`
