[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / OmniaExecutionPort

# Interface: OmniaExecutionPort

Minimal port wrapping live Omnia channel operations.

## Methods

### addHTLC()

> **addHTLC**(`channel`, `params`): `Promise`\<`OmniaChannel`\>

#### Parameters

##### channel

`OmniaChannel`

##### params

`AddHTLCParams`

#### Returns

`Promise`\<`OmniaChannel`\>

***

### closeChannel()

> **closeChannel**(`channel`): `Promise`\<[`ChannelCloseResult`](ChannelCloseResult.md)\>

Close a channel and return its final close artifact.

#### Parameters

##### channel

`OmniaChannel`

#### Returns

`Promise`\<[`ChannelCloseResult`](ChannelCloseResult.md)\>

***

### createChannel()

> **createChannel**(`params`): `Promise`\<`OmniaChannel`\>

#### Parameters

##### params

`CreateChannelParams`

#### Returns

`Promise`\<`OmniaChannel`\>

***

### fulfillHTLC()

> **fulfillHTLC**(`channel`, `htlcId`, `preimage`): `Promise`\<`OmniaChannel`\>

#### Parameters

##### channel

`OmniaChannel`

##### htlcId

`string`

##### preimage

`Uint8Array`

#### Returns

`Promise`\<`OmniaChannel`\>

***

### proposeSettlement()

> **proposeSettlement**(`channel`): `Promise`\<`SettlementPayload`\>

#### Parameters

##### channel

`OmniaChannel`

#### Returns

`Promise`\<`SettlementPayload`\>

***

### updateState()

> **updateState**(`channel`, `delta`): `Promise`\<`SignedChannelState`\>

#### Parameters

##### channel

`OmniaChannel`

##### delta

`UpdateDelta`

#### Returns

`Promise`\<`SignedChannelState`\>

***

### verifyStateForCoSign()

> **verifyStateForCoSign**(`channel`, `state`): `Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

Validate a one-party state update before this node adds its co-signature.
The co-sign verification boundary is load-bearing — it prevents a taker from
attaching a signature to a bad state — so it is a port, not caller-side boilerplate.

#### Parameters

##### channel

`OmniaChannel`

##### state

`SignedChannelState`

#### Returns

`Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>
