[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / CoinSelectionError

# Class: CoinSelectionError

## Extends

- `Error`

## Constructors

### Constructor

> **new CoinSelectionError**(`message`, `code`, `details?`): `CoinSelectionError`

#### Parameters

##### message

`string`

##### code

`"FETCH_FAILED"` \| `"INSUFFICIENT_FUNDS"` \| `"SERVICE_UNAVAILABLE"` \| `"NETWORK_ERROR"`

##### details?

`Record`\<`string`, `any`\>

#### Returns

`CoinSelectionError`

#### Overrides

`Error.constructor`

## Properties

### cause?

> `optional` **cause?**: `unknown`

#### Inherited from

`Error.cause`

***

### code

> `readonly` **code**: `"FETCH_FAILED"` \| `"INSUFFICIENT_FUNDS"` \| `"SERVICE_UNAVAILABLE"` \| `"NETWORK_ERROR"`

***

### details?

> `readonly` `optional` **details?**: `Record`\<`string`, `any`\>

***

### message

> **message**: `string`

#### Inherited from

`Error.message`

***

### name

> **name**: `string`

#### Inherited from

`Error.name`

***

### stack?

> `optional` **stack?**: `string`

#### Inherited from

`Error.stack`
