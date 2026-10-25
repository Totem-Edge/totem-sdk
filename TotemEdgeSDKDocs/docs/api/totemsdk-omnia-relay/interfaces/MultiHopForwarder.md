[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / MultiHopForwarder

# Interface: MultiHopForwarder

## Methods

### forwardIncoming()

> **forwardIncoming**(`params`): `Promise`\<[`ForwardIncomingResult`](../type-aliases/ForwardIncomingResult.md)\>

#### Parameters

##### params

[`ForwardIncomingParams`](ForwardIncomingParams.md)

#### Returns

`Promise`\<[`ForwardIncomingResult`](../type-aliases/ForwardIncomingResult.md)\>

***

### links()

> **links**(): `ReadonlyMap`\<`string`, [`HtlcLink`](HtlcLink.md)\>

#### Returns

`ReadonlyMap`\<`string`, [`HtlcLink`](HtlcLink.md)\>

***

### revealPreimage()

> **revealPreimage**(`hashlock`, `preimage`): `Promise`\<[`RevealPreimageResult`](../type-aliases/RevealPreimageResult.md)\>

#### Parameters

##### hashlock

`string`

##### preimage

`string`

#### Returns

`Promise`\<[`RevealPreimageResult`](../type-aliases/RevealPreimageResult.md)\>
