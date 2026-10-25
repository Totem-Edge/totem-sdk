[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / runWithPolicy

# Function: runWithPolicy()

> **runWithPolicy**\<`TResult`\>(`def`, `op`): `Promise`\<[`IndustrialExecutionResult`](../interfaces/IndustrialExecutionResult.md)\<`TResult`\>\>

Run an industrial definition's actuation under its execution policy.
Exported for direct use in tests and by adapters that own their own runtime.

## Type Parameters

### TResult

`TResult` = `unknown`

## Parameters

### def

[`IndustrialActionDefinition`](../interfaces/IndustrialActionDefinition.md)\<`TResult`\>

### op

[`PreparedDeviceOp`](../interfaces/PreparedDeviceOp.md)

## Returns

`Promise`\<[`IndustrialExecutionResult`](../interfaces/IndustrialExecutionResult.md)\<`TResult`\>\>
