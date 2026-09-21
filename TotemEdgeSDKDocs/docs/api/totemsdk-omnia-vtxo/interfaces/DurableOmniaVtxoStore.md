[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / DurableOmniaVtxoStore

# Interface: DurableOmniaVtxoStore

## Extends

- [`OmniaVtxoStore`](OmniaVtxoStore.md)

## Methods

### getPool()

> **getPool**(`poolId`): `Promise`\<[`OmniaVtxoPool`](OmniaVtxoPool.md) \| `undefined`\>

#### Parameters

##### poolId

`string`

#### Returns

`Promise`\<[`OmniaVtxoPool`](OmniaVtxoPool.md) \| `undefined`\>

#### Inherited from

[`OmniaVtxoStore`](OmniaVtxoStore.md).[`getPool`](OmniaVtxoStore.md#getpool)

***

### getRevision()

> **getRevision**(): `Promise`\<`number`\>

Current registry transition counter (0 before the first write).

#### Returns

`Promise`\<`number`\>

***

### getSnapshot()

> **getSnapshot**(): `Promise`\<[`OmniaVtxoRegistryState`](OmniaVtxoRegistryState.md)\>

Current persisted snapshot state (pool + vtxo maps).

#### Returns

`Promise`\<[`OmniaVtxoRegistryState`](OmniaVtxoRegistryState.md)\>

***

### getVtxo()

> **getVtxo**(`vtxoId`): `Promise`\<[`OmniaVtxo`](OmniaVtxo.md) \| `undefined`\>

#### Parameters

##### vtxoId

`string`

#### Returns

`Promise`\<[`OmniaVtxo`](OmniaVtxo.md) \| `undefined`\>

#### Inherited from

[`OmniaVtxoStore`](OmniaVtxoStore.md).[`getVtxo`](OmniaVtxoStore.md#getvtxo)

***

### hasState()

> **hasState**(): `Promise`\<`boolean`\>

True once any snapshot record has been persisted.

#### Returns

`Promise`\<`boolean`\>

***

### listVtxos()

> **listVtxos**(`poolId?`): `Promise`\<[`OmniaVtxo`](OmniaVtxo.md)[]\>

#### Parameters

##### poolId?

`string`

#### Returns

`Promise`\<[`OmniaVtxo`](OmniaVtxo.md)[]\>

#### Inherited from

[`OmniaVtxoStore`](OmniaVtxoStore.md).[`listVtxos`](OmniaVtxoStore.md#listvtxos)

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

#### Inherited from

[`OmniaVtxoStore`](OmniaVtxoStore.md).[`markVtxoSpent`](OmniaVtxoStore.md#markvtxospent)

***

### savePool()

> **savePool**(`pool`): `Promise`\<`void`\>

#### Parameters

##### pool

[`OmniaVtxoPool`](OmniaVtxoPool.md)

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`OmniaVtxoStore`](OmniaVtxoStore.md).[`savePool`](OmniaVtxoStore.md#savepool)

***

### saveVtxo()

> **saveVtxo**(`vtxo`): `Promise`\<`void`\>

#### Parameters

##### vtxo

[`OmniaVtxo`](OmniaVtxo.md)

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`OmniaVtxoStore`](OmniaVtxoStore.md).[`saveVtxo`](OmniaVtxoStore.md#savevtxo)
