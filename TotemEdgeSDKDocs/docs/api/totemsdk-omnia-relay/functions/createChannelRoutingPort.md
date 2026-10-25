[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / createChannelRoutingPort

# Function: createChannelRoutingPort()

> **createChannelRoutingPort**(`getChannels`, `options?`): [`RoutingPort`](../interfaces/RoutingPort.md)

Build a [RoutingPort](../interfaces/RoutingPort.md) from a live channel source (RFC-034 §6.1 source
#2: the wallet's own channels). Hosts that hold a fuller topology (a
self-hosted relay sidecar) inject their own `RoutingPort` instead.

## Parameters

### getChannels

() => `Iterable`\<[`OmniaChannel`](../interfaces/OmniaChannel.md)\>

### options?

#### swaps?

() => readonly `SwapAnnouncement`[]

## Returns

[`RoutingPort`](../interfaces/RoutingPort.md)
