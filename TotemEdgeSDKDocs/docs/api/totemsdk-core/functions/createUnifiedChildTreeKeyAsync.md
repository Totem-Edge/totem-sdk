[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / createUnifiedChildTreeKeyAsync

# Function: createUnifiedChildTreeKeyAsync()

> **createUnifiedChildTreeKeyAsync**(`baseSeed`, `index`, `onProgress?`): `Promise`\<[`TreeKey`](../classes/TreeKey.md)\>

Async version with progress reporting for UI.

## Parameters

### baseSeed

`Bytes`

32-byte wallet base seed

### index

`number`

Address index (0-63)

### onProgress?

[`ProgressCallback`](../type-aliases/ProgressCallback.md)

Optional progress callback

## Returns

`Promise`\<[`TreeKey`](../classes/TreeKey.md)\>

Promise resolving to the child TreeKey
