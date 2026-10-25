[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / CreateChannelParams

# Interface: CreateChannelParams

## Properties

### channelType?

> `optional` **channelType?**: `"direct"` \| `"virtual"`

***

### contestDelayBlocks?

> `optional` **contestDelayBlocks?**: `number`

Blocks the counterparty must wait before a settlement spend is valid
(eltoo contest window). Defaults to 256. Short values are for test/dev
networks only — a short window weakens unilateral-close protection.

***

### factoryRef?

> `optional` **factoryRef?**: `string`

***

### fundingCoinId

> **fundingCoinId**: `string`

***

### fundingProofs?

> `optional` **fundingProofs?**: `object`

Alternative to `fundingWitnessBytes`: the funding input proofs (serialized
Minima CoinProof + ScriptProof). Used with `fundingSigner` so createChannel
assembles the witness itself.

#### coinProofs

> **coinProofs**: `Uint8Array`\<`ArrayBufferLike`\>[]

#### scriptProofs

> **scriptProofs**: `Uint8Array`\<`ArrayBufferLike`\>[]

***

### fundingScript?

> `optional` **fundingScript?**: `string`

The Minima (KISSVM) script whose hash is the funding coin's address. When
set (and `fundingWitnessBytes` is absent) createChannel builds the required
single-leaf `ScriptProof` itself via `buildScriptProof` and appends it to
the witness. The node requires a ScriptProof for every input address, so
callers that only have the address script should pass it here instead of
hand-rolling `fundingProofs.scriptProofs`.

***

### fundingSigner?

> `optional` **fundingSigner?**: (`digest`) => `Uint8Array`\<`ArrayBufferLike`\> \| `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Sign the funding transaction digest (WOTS). Called only when
`fundingWitnessBytes` is absent. Lets a wallet sign the exact digest
createChannel built, without the caller reproducing the funding draft.

#### Parameters

##### digest

`Uint8Array`

#### Returns

`Uint8Array`\<`ArrayBufferLike`\> \| `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### fundingWitnessBytes?

> `optional` **fundingWitnessBytes?**: `Uint8Array`\<`ArrayBufferLike`\>

Serialized Minima witness for the funding transaction input(s). Required for createChannel broadcast.

***

### localAmount

> **localAmount**: `bigint`

***

### localParty

> **localParty**: [`ChannelParticipant`](ChannelParticipant.md)

***

### program?

> `optional` **program?**: [`ChannelProgram`](ChannelProgram.md)

***

### remoteAmount

> **remoteAmount**: `bigint`

***

### remoteParty

> **remoteParty**: [`ChannelParticipant`](ChannelParticipant.md)

***

### tokenId?

> `optional` **tokenId?**: `string`

***

### tokenScale?

> `optional` **tokenScale?**: `number`

Scale factor for coloured coins. 0 = native Minima. Default: 0.
