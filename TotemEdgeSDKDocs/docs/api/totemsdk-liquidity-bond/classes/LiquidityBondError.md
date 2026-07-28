[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / LiquidityBondError

# Class: LiquidityBondError

## Extends

- `Error`

## Extended by

- [`LiquidityPoolManifestError`](LiquidityPoolManifestError.md)
- [`LiquidityIdentityError`](LiquidityIdentityError.md)
- [`LiquidityCommitmentError`](LiquidityCommitmentError.md)
- [`LiquidityPositionError`](LiquidityPositionError.md)
- [`LiquidityReceiptError`](LiquidityReceiptError.md)
- [`LiquidityAllocationError`](LiquidityAllocationError.md)
- [`LiquidityFeeError`](LiquidityFeeError.md)
- [`LiquidityWithdrawalError`](LiquidityWithdrawalError.md)
- [`LiquidityRiskError`](LiquidityRiskError.md)
- [`LiquidityPolicyError`](LiquidityPolicyError.md)
- [`LiquidityRegistryError`](LiquidityRegistryError.md)
- [`LiquiditySerializationError`](LiquiditySerializationError.md)

## Constructors

### Constructor

> **new LiquidityBondError**(`message`, `code?`, `details?`): `LiquidityBondError`

#### Parameters

##### message

`string`

##### code?

`string`

##### details?

`unknown`

#### Returns

`LiquidityBondError`

#### Overrides

`Error.constructor`

## Properties

### code?

> `optional` **code?**: `string`

***

### details?

> `optional` **details?**: `unknown`

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
