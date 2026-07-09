[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / WotsSigningDependencies

# ~~Interface: WotsSigningDependencies~~

## Deprecated

WotsSigningDependencies is no longer used by TransactionService.sign().
The service now derives everything from the seed and indices directly using
the built-in TreeKey implementation. This interface is kept for backward compatibility
only and will be removed in a future version.

## Properties

### ~~defaultParamSet?~~

> `optional` **defaultParamSet?**: `any`

***

### ~~fromHex?~~

> `optional` **fromHex?**: (`hex`) => `Uint8Array`

#### Parameters

##### hex

`string`

#### Returns

`Uint8Array`

***

### ~~getParamSet?~~

> `optional` **getParamSet?**: (`name`) => `any`

#### Parameters

##### name

`string`

#### Returns

`any`

***

### ~~wotsSign?~~

> `optional` **wotsSign?**: (`seed`, `index`, `message`, `paramSet`) => `Uint8Array`

#### Parameters

##### seed

`Uint8Array`

##### index

`number`

##### message

`Uint8Array`

##### paramSet

`any`

#### Returns

`Uint8Array`
