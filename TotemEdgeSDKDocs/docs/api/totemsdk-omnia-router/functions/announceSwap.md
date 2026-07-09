[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / announceSwap

# Function: announceSwap()

> **announceSwap**(`graph`, `announcement`): `void`

Register a swap announcement from a bridging intermediary.

Validates that the rate is a positive finite decimal before storing.
Throws `Error` if the rate is zero or negative.

Duplicate announcements (same `intermediaryPubKey` + `inboundChannelId`)
are replaced to prevent stale rate data.

## Parameters

### graph

[`ChannelGraph`](../interfaces/ChannelGraph.md)

### announcement

[`SwapAnnouncement`](../interfaces/SwapAnnouncement.md)

## Returns

`void`
