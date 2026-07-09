[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / UpdateStateResult

# Interface: UpdateStateResult

Return type of `updateState`.

Normal case: `{ channel, signedState }`.
Near-exhaustion case (≥95% of 4096 WOTS slots used): `{ channel, signedState, error: 'CAPACITY_NEAR_EXHAUSTION' }`.
At 100% `updateState` throws `ChannelCapacityError` instead.

The `channel` field is always present to allow callers to inspect the unchanged
channel object even when the update was blocked.

## Properties

### channel

> **channel**: [`OmniaChannel`](OmniaChannel.md)

***

### error?

> `optional` **error?**: `"CAPACITY_NEAR_EXHAUSTION"`

***

### signedState

> **signedState**: `Partial`\<[`SignedChannelState`](SignedChannelState.md)\>
