[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / VtxoExecutionPort

# Interface: VtxoExecutionPort

Minimal port wrapping live VTXO pool operations.

## Methods

### createExitDraft()

> **createExitDraft**(`vtxo`): `Promise`\<`ExitDraft`\>

#### Parameters

##### vtxo

`OmniaVtxo`

#### Returns

`Promise`\<`ExitDraft`\>

***

### createPool()

> **createPool**(`params`): `Promise`\<`OmniaVtxoPool`\>

#### Parameters

##### params

###### nonce

`string`

###### operator

`string`

###### policy?

`unknown`

###### poolId

`string`

###### tokenId

`string`

###### totalCapacity

`string`

#### Returns

`Promise`\<`OmniaVtxoPool`\>

***

### markExited()

> **markExited**(`pool`, `vtxoId`, `txpowId`): `Promise`\<`OmniaVtxoPool`\>

#### Parameters

##### pool

`OmniaVtxoPool`

##### vtxoId

`string`

##### txpowId

`string`

#### Returns

`Promise`\<`OmniaVtxoPool`\>

***

### markExiting()

> **markExiting**(`pool`, `vtxoId`): `Promise`\<`OmniaVtxoPool`\>

#### Parameters

##### pool

`OmniaVtxoPool`

##### vtxoId

`string`

#### Returns

`Promise`\<`OmniaVtxoPool`\>

***

### mintVtxo()

> **mintVtxo**(`pool`, `params`): `Promise`\<\{ `pool`: `OmniaVtxoPool`; `vtxo`: `OmniaVtxo`; \}\>

#### Parameters

##### pool

`OmniaVtxoPool`

##### params

`MintVtxoParams`

#### Returns

`Promise`\<\{ `pool`: `OmniaVtxoPool`; `vtxo`: `OmniaVtxo`; \}\>
