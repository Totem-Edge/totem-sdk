[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / SpliceChainObserver

# Interface: SpliceChainObserver

Minimal chain surface needed by splice observation.

## Methods

### getCoins()

> **getCoins**(`query`): `Promise`\<`object`[]\>

#### Parameters

##### query

###### address?

`string`

###### coinId?

`string`

###### relevant?

`boolean`

###### tokenId?

`string`

#### Returns

`Promise`\<`object`[]\>

***

### getTip()

> **getTip**(): `Promise`\<\{ `block`: `number`; \}\>

#### Returns

`Promise`\<\{ `block`: `number`; \}\>

***

### getTransaction()?

> `optional` **getTransaction**(`txpowid`): `Promise`\<\{ `inputs`: `object`[]; `outputs`: `object`[]; `txpowid`: `string`; \} \| `null`\>

Full transaction body by TxPoW id (OMN-074).

Optional only so adapters can be upgraded independently. When it is present,
successor observation proves the coin is an output of the splice that named
it; when it is absent and lineage is required, observation fails closed.

#### Parameters

##### txpowid

`string`

#### Returns

`Promise`\<\{ `inputs`: `object`[]; `outputs`: `object`[]; `txpowid`: `string`; \} \| `null`\>
