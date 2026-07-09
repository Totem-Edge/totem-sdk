[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / TimelockHelper

# Class: TimelockHelper

Timelock Helper

Creates timelocked scripts that can only be spent after a certain block.

## Constructors

### Constructor

> **new TimelockHelper**(): `TimelockHelper`

#### Returns

`TimelockHelper`

## Methods

### buildDescriptor()

> `static` **buildDescriptor**(`address`, `publicKey`, `unlockBlock`): [`ScriptDescriptor`](../interfaces/ScriptDescriptor.md)

Build ScriptDescriptor for a timelock spend.

#### Parameters

##### address

`string`

##### publicKey

`string`

##### unlockBlock

`bigint`

#### Returns

[`ScriptDescriptor`](../interfaces/ScriptDescriptor.md)

***

### createBlockTimelock()

> `static` **createBlockTimelock**(`publicKey`, `unlockBlock`): `object`

Create a timelock script that unlocks at a specific block.

#### Parameters

##### publicKey

`string`

##### unlockBlock

`bigint`

#### Returns

`object`

##### address

> **address**: `string`

##### script

> **script**: `string`

***

### createCoinageTimelock()

> `static` **createCoinageTimelock**(`publicKey`, `minCoinAge`): `object`

Create a timelock script based on coin age.

#### Parameters

##### publicKey

`string`

##### minCoinAge

`bigint`

#### Returns

`object`

##### address

> **address**: `string`

##### script

> **script**: `string`

***

### isUnlocked()

> `static` **isUnlocked**(`unlockBlock`, `currentBlock`): `boolean`

Check if a timelock is satisfied given current block.

#### Parameters

##### unlockBlock

`bigint`

##### currentBlock

`bigint`

#### Returns

`boolean`
