[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / FlashCashHelper

# Class: FlashCashHelper

Flash Cash Helper

Creates flash loan contracts for single-transaction borrowing.

## Constructors

### Constructor

> **new FlashCashHelper**(): `FlashCashHelper`

#### Returns

`FlashCashHelper`

## Methods

### buildBorrowDescriptor()

> `static` **buildBorrowDescriptor**(`address`, `ownerPublicKey`, `interestMultiplier?`): [`ScriptDescriptor`](../interfaces/ScriptDescriptor.md)

Build ScriptDescriptor for borrowing flash cash.

#### Parameters

##### address

`string`

##### ownerPublicKey

`string`

##### interestMultiplier?

`string`

#### Returns

[`ScriptDescriptor`](../interfaces/ScriptDescriptor.md)

***

### calculateReturn()

> `static` **calculateReturn**(`borrowAmount`, `interestMultiplier`): `bigint`

Calculate return amount with interest.

#### Parameters

##### borrowAmount

`bigint`

##### interestMultiplier

`number`

#### Returns

`bigint`

***

### createFlashCash()

> `static` **createFlashCash**(`ownerPublicKey`, `interestMultiplier?`): `object`

Create a flash cash contract.

#### Parameters

##### ownerPublicKey

`string`

##### interestMultiplier?

`string`

#### Returns

`object`

##### address

> **address**: `string`

##### script

> **script**: `string`
