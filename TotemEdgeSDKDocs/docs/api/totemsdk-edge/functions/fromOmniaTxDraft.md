[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / fromOmniaTxDraft

# Function: fromOmniaTxDraft()

> **fromOmniaTxDraft**(`draft`, `channelScriptAddress`, `channelOps?`): [`BuiltTransaction`](../interfaces/BuiltTransaction.md)

Normalize an `OmniaTxDraft` (@totemsdk/omnia) into a `BuiltTransaction`.
The channel's own script address is excluded from spends — a channel update
pays the full value back to the channel script (state change, not spend).

## Parameters

### draft

#### inputs

`object`[]

#### outputs

`object`[]

### channelScriptAddress

`string`

### channelOps?

`object`[]

## Returns

[`BuiltTransaction`](../interfaces/BuiltTransaction.md)
