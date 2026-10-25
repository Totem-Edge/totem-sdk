[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / buildChannelOpening

# Function: buildChannelOpening()

> **buildChannelOpening**(`params`, `chainProvider`): `Promise`\<[`ChannelOpeningPlan`](../interfaces/ChannelOpeningPlan.md)\>

Build a channel opening without broadcasting: resolve the program/script,
read the funding coin, construct the deterministic funding draft and return
its digest for wallet signing.

## Parameters

### params

[`CreateChannelParams`](../interfaces/CreateChannelParams.md)

### chainProvider

`ChainStateProvider`

## Returns

`Promise`\<[`ChannelOpeningPlan`](../interfaces/ChannelOpeningPlan.md)\>
