[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / BuiltTransaction

# Interface: BuiltTransaction

## Properties

### channelOps?

> `optional` **channelOps?**: `object`[]

Channel operations performed (channelId + operation).

#### channelId

> **channelId**: `string`

#### operation

> **operation**: `string`

***

### channelScriptAddress?

> `optional` **channelScriptAddress?**: `string`

Channel script address — outputs to it are channel-internal state.

***

### fees?

> `optional` **fees?**: `object`[]

Fees paid (tokenId + amount).

#### amount

> **amount**: `string`

#### tokenId

> **tokenId**: `string`

***

### inputs

> **inputs**: [`BuiltTxInput`](BuiltTxInput.md)[]

***

### outputs

> **outputs**: [`BuiltTxOutput`](BuiltTxOutput.md)[]

***

### ownAddresses

> **ownAddresses**: `string`[]

Addresses the wallet controls — outputs to these are change, not spends.
