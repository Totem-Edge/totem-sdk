[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / SlowCashHelper

# Class: SlowCashHelper

Slow Cash Helper

Creates rate-limited withdrawal contracts.

## Constructors

### Constructor

> **new SlowCashHelper**(): `SlowCashHelper`

#### Returns

`SlowCashHelper`

## Methods

### buildWithdrawalDescriptor()

> `static` **buildWithdrawalDescriptor**(`address`, `ownerPublicKey`, `withdrawalPercent?`, `cooldownBlocks?`): [`ScriptDescriptor`](../interfaces/ScriptDescriptor.md)

Build ScriptDescriptor for slow cash withdrawal.

#### Parameters

##### address

`string`

##### ownerPublicKey

`string`

##### withdrawalPercent?

`string`

##### cooldownBlocks?

`bigint`

#### Returns

[`ScriptDescriptor`](../interfaces/ScriptDescriptor.md)

***

### calculateWithdrawal()

> `static` **calculateWithdrawal**(`currentAmount`, `withdrawalPercent`): `object`

Calculate withdrawal amount.

#### Parameters

##### currentAmount

`bigint`

##### withdrawalPercent

`number`

#### Returns

`object`

##### remaining

> **remaining**: `bigint`

##### withdrawal

> **withdrawal**: `bigint`

***

### canWithdraw()

> `static` **canWithdraw**(`coinAge`, `cooldownBlocks`): `boolean`

Check if withdrawal is allowed based on coin age.

#### Parameters

##### coinAge

`bigint`

##### cooldownBlocks

`bigint`

#### Returns

`boolean`

***

### createSlowCash()

> `static` **createSlowCash**(`ownerPublicKey`, `withdrawalPercent?`, `cooldownBlocks?`): `object`

Create a slow cash contract.

#### Parameters

##### ownerPublicKey

`string`

##### withdrawalPercent?

`string`

##### cooldownBlocks?

`bigint`

#### Returns

`object`

##### address

> **address**: `string`

##### script

> **script**: `string`
