[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / VaultHelper

# Class: VaultHelper

Vault Helper

Creates vault/covenant contracts with safe house enforcement.

## Constructors

### Constructor

> **new VaultHelper**(): `VaultHelper`

#### Returns

`VaultHelper`

## Methods

### buildWithdrawalState()

> `static` **buildWithdrawalState**(`amount`, `recipientAddress`): [`StateValue`](../interfaces/StateValue.md)[]

Build state for vault withdrawal.

#### Parameters

##### amount

`string`

##### recipientAddress

`string`

#### Returns

[`StateValue`](../interfaces/StateValue.md)[]

***

### createVault()

> `static` **createVault**(`coldKey`, `hotKey`, `cooldownBlocks?`): `object`

Create a vault script.

#### Parameters

##### coldKey

`string`

##### hotKey

`string`

##### cooldownBlocks?

`bigint` = `20n`

#### Returns

`object`

##### safeHouseAddress

> **safeHouseAddress**: `string`

##### safeHouseScript

> **safeHouseScript**: `string`

##### vaultAddress

> **vaultAddress**: `string`

##### vaultScript

> **vaultScript**: `string`

***

### generateSafeHouseScript()

> `static` **generateSafeHouseScript**(`coldKey`, `hotKey`, `cooldownBlocks?`): `string`

Generate safe house script from vault parameters.

#### Parameters

##### coldKey

`string`

##### hotKey

`string`

##### cooldownBlocks?

`bigint` = `20n`

#### Returns

`string`
