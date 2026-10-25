[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / WalletRuntimeOptions

# Interface: WalletRuntimeOptions

## Properties

### approve?

> `readonly` `optional` **approve?**: (`request`) => `Promise`\<`boolean`\>

Approval enforcement: return false to reject an approval-required method.

#### Parameters

##### request

###### method

`string`

###### origin?

`string`

###### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`boolean`\>

***

### handlers?

> `readonly` `optional` **handlers?**: readonly [`WalletMethodHandler`](WalletMethodHandler.md)[]

Override or extend the default handlers (keyed by method).

***

### info?

> `readonly` `optional` **info?**: [`TotemWalletInfo`](TotemWalletInfo.md)
