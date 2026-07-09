[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / MemoryOmniaVtxoStore

# Class: MemoryOmniaVtxoStore

## Implements

- [`OmniaVtxoStore`](../interfaces/OmniaVtxoStore.md)

## Constructors

### Constructor

> **new MemoryOmniaVtxoStore**(): `MemoryOmniaVtxoStore`

#### Returns

`MemoryOmniaVtxoStore`

## Methods

### getPool()

> **getPool**(`poolId`): `Promise`\<[`OmniaVtxoPool`](../interfaces/OmniaVtxoPool.md) \| `undefined`\>

#### Parameters

##### poolId

`string`

#### Returns

`Promise`\<[`OmniaVtxoPool`](../interfaces/OmniaVtxoPool.md) \| `undefined`\>

#### Implementation of

[`OmniaVtxoStore`](../interfaces/OmniaVtxoStore.md).[`getPool`](../interfaces/OmniaVtxoStore.md#getpool)

***

### getVtxo()

> **getVtxo**(`vtxoId`): `Promise`\<[`OmniaVtxo`](../interfaces/OmniaVtxo.md) \| `undefined`\>

#### Parameters

##### vtxoId

`string`

#### Returns

`Promise`\<[`OmniaVtxo`](../interfaces/OmniaVtxo.md) \| `undefined`\>

#### Implementation of

[`OmniaVtxoStore`](../interfaces/OmniaVtxoStore.md).[`getVtxo`](../interfaces/OmniaVtxoStore.md#getvtxo)

***

### listVtxos()

> **listVtxos**(`poolId?`): `Promise`\<[`OmniaVtxo`](../interfaces/OmniaVtxo.md)[]\>

#### Parameters

##### poolId?

`string`

#### Returns

`Promise`\<[`OmniaVtxo`](../interfaces/OmniaVtxo.md)[]\>

#### Implementation of

[`OmniaVtxoStore`](../interfaces/OmniaVtxoStore.md).[`listVtxos`](../interfaces/OmniaVtxoStore.md#listvtxos)

***

### markVtxoSpent()

> **markVtxoSpent**(`vtxoId`, `now?`): `Promise`\<`void`\>

Marks a VTXO as spent. Accepts an optional `now` timestamp for deterministic testing.
When `now` is omitted the store falls back to `Date.now()` — this is intentional
and explicitly documented: the store is a persistence layer, not a pure function,
so wall-clock time is an acceptable default for production use. Pass `now` in tests.

#### Parameters

##### vtxoId

`string`

##### now?

`number`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`OmniaVtxoStore`](../interfaces/OmniaVtxoStore.md).[`markVtxoSpent`](../interfaces/OmniaVtxoStore.md#markvtxospent)

***

### savePool()

> **savePool**(`pool`): `Promise`\<`void`\>

#### Parameters

##### pool

[`OmniaVtxoPool`](../interfaces/OmniaVtxoPool.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`OmniaVtxoStore`](../interfaces/OmniaVtxoStore.md).[`savePool`](../interfaces/OmniaVtxoStore.md#savepool)

***

### saveVtxo()

> **saveVtxo**(`vtxo`): `Promise`\<`void`\>

#### Parameters

##### vtxo

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`OmniaVtxoStore`](../interfaces/OmniaVtxoStore.md).[`saveVtxo`](../interfaces/OmniaVtxoStore.md#savevtxo)
