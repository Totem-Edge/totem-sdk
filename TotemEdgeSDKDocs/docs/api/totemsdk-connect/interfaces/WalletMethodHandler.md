[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / WalletMethodHandler

# Interface: WalletMethodHandler

## Properties

### method

> `readonly` **method**: `string`

***

### requiredCapabilities

> `readonly` **requiredCapabilities**: readonly `string`[]

***

### requiresApproval?

> `readonly` `optional` **requiresApproval?**: `boolean`

## Methods

### handle()

> **handle**(`params`, `ctx`, `signal?`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

##### ctx

[`WalletHandlerContext`](WalletHandlerContext.md)

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`unknown`\>
