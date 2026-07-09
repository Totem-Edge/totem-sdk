[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / LookupLike

# Interface: LookupLike

Duck-typed subset of LookupClient that LookupBackend needs.
A real @totemsdk/lookup-client `LookupClient` satisfies this automatically.

## Methods

### getCoins()

> **getCoins**(`query`): `Promise`\<`LookupCoin`[]\>

#### Parameters

##### query

###### address?

`string`

###### relevant?

`boolean`

###### sendable?

`boolean`

#### Returns

`Promise`\<`LookupCoin`[]\>

***

### subscribeCoinUpdates()

> **subscribeCoinUpdates**(`cb`): () => `void`

#### Parameters

##### cb

(`event`) => `void`

#### Returns

() => `void`

***

### watchAddress()

> **watchAddress**(`address`): `Promise`\<`void`\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`void`\>
