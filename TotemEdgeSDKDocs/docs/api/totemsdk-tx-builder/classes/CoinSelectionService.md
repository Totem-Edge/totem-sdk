[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / CoinSelectionService

# Class: CoinSelectionService

## Constructors

### Constructor

> **new CoinSelectionService**(`fetcher`, `storage?`): `CoinSelectionService`

#### Parameters

##### fetcher

[`CoinFetcher`](../interfaces/CoinFetcher.md)

##### storage?

[`KeyValueStorage`](../interfaces/KeyValueStorage.md)

#### Returns

`CoinSelectionService`

## Methods

### addExcludedAddress()

> **addExcludedAddress**(`address`): `void`

#### Parameters

##### address

`string`

#### Returns

`void`

***

### fetchSpendableCoins()

> **fetchSpendableCoins**(`addresses`, `tokenId?`): `Promise`\<[`SpendableCoin`](../interfaces/SpendableCoin.md)[]\>

#### Parameters

##### addresses

`string`[]

##### tokenId?

`string` = `'0x00'`

#### Returns

`Promise`\<[`SpendableCoin`](../interfaces/SpendableCoin.md)[]\>

***

### formatCoinInputs()

> **formatCoinInputs**(`coins`): `object`[]

#### Parameters

##### coins

[`SpendableCoin`](../interfaces/SpendableCoin.md)[]

#### Returns

`object`[]

***

### getExcludedAddresses()

> **getExcludedAddresses**(): `string`[]

#### Returns

`string`[]

***

### isAddressExcluded()

> **isAddressExcluded**(`address`): `boolean`

#### Parameters

##### address

`string`

#### Returns

`boolean`

***

### loadExcludedAddresses()

> **loadExcludedAddresses**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### orderCoinsByAmount()

> **orderCoinsByAmount**(`coins`): [`SpendableCoin`](../interfaces/SpendableCoin.md)[]

#### Parameters

##### coins

[`SpendableCoin`](../interfaces/SpendableCoin.md)[]

#### Returns

[`SpendableCoin`](../interfaces/SpendableCoin.md)[]

***

### removeExcludedAddress()

> **removeExcludedAddress**(`address`): `void`

#### Parameters

##### address

`string`

#### Returns

`void`

***

### saveExcludedAddresses()

> **saveExcludedAddresses**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### selectCoins()

> **selectCoins**(`coins`, `options`): [`CoinSelectionResult`](../interfaces/CoinSelectionResult.md)

#### Parameters

##### coins

[`SpendableCoin`](../interfaces/SpendableCoin.md)[]

##### options

[`CoinSelectionOptions`](../interfaces/CoinSelectionOptions.md)

#### Returns

[`CoinSelectionResult`](../interfaces/CoinSelectionResult.md)

***

### selectCoinsForSend()

> **selectCoinsForSend**(`allAddresses`, `options`): `Promise`\<[`CoinSelectionResult`](../interfaces/CoinSelectionResult.md)\>

#### Parameters

##### allAddresses

`string`[]

##### options

[`CoinSelectionOptions`](../interfaces/CoinSelectionOptions.md)

#### Returns

`Promise`\<[`CoinSelectionResult`](../interfaces/CoinSelectionResult.md)\>
