[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / OmniaVtxoStore

# Interface: OmniaVtxoStore

## Methods

### getPool()

> **getPool**(`poolId`): `Promise`\<[`OmniaVtxoPool`](OmniaVtxoPool.md) \| `undefined`\>

#### Parameters

##### poolId

`string`

#### Returns

`Promise`\<[`OmniaVtxoPool`](OmniaVtxoPool.md) \| `undefined`\>

***

### getVtxo()

> **getVtxo**(`vtxoId`): `Promise`\<[`OmniaVtxo`](OmniaVtxo.md) \| `undefined`\>

#### Parameters

##### vtxoId

`string`

#### Returns

`Promise`\<[`OmniaVtxo`](OmniaVtxo.md) \| `undefined`\>

***

### listVtxos()

> **listVtxos**(`poolId?`): `Promise`\<[`OmniaVtxo`](OmniaVtxo.md)[]\>

#### Parameters

##### poolId?

`string`

#### Returns

`Promise`\<[`OmniaVtxo`](OmniaVtxo.md)[]\>

***

### markVtxoSpent()

> **markVtxoSpent**(`vtxoId`, `now?`): `Promise`\<`void`\>

#### Parameters

##### vtxoId

`string`

##### now?

`number`

#### Returns

`Promise`\<`void`\>

***

### savePool()

> **savePool**(`pool`): `Promise`\<`void`\>

#### Parameters

##### pool

[`OmniaVtxoPool`](OmniaVtxoPool.md)

#### Returns

`Promise`\<`void`\>

***

### saveVtxo()

> **saveVtxo**(`vtxo`): `Promise`\<`void`\>

#### Parameters

##### vtxo

[`OmniaVtxo`](OmniaVtxo.md)

#### Returns

`Promise`\<`void`\>
