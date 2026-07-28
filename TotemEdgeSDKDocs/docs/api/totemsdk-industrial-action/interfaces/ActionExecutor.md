[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / ActionExecutor

# Interface: ActionExecutor\<TParameters, TResult\>

## Type Parameters

### TParameters

`TParameters` = `unknown`

### TResult

`TResult` = `unknown`

## Properties

### kind

> **kind**: `string`

## Methods

### execute()

> **execute**(`proposal`, `params`, `context`): `Promise`\<`EdgeOperationResult`\<`TResult`\>\>

#### Parameters

##### proposal

[`ActionProposal`](ActionProposal.md)

##### params

`TParameters`

##### context

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`EdgeOperationResult`\<`TResult`\>\>
