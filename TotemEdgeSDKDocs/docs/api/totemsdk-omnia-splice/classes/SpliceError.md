[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / SpliceError

# Class: SpliceError

## Extends

- `Error`

## Extended by

- [`PendingHTLCError`](PendingHTLCError.md)
- [`SpliceChannelStatusError`](SpliceChannelStatusError.md)
- [`SpliceBalanceConservationError`](SpliceBalanceConservationError.md)
- [`SpliceSignatureMismatchError`](SpliceSignatureMismatchError.md)
- [`SpliceMissingPartyError`](SpliceMissingPartyError.md)
- [`SpliceInsufficientFundsError`](SpliceInsufficientFundsError.md)

## Constructors

### Constructor

> **new SpliceError**(`code`, `message`): `SpliceError`

#### Parameters

##### code

`string`

##### message

`string`

#### Returns

`SpliceError`

#### Overrides

`Error.constructor`

## Properties

### code

> `readonly` **code**: `string`

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
