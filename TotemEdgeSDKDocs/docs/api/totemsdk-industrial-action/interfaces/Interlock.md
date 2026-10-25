[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / Interlock

# Interface: Interlock

## Properties

### id

> **id**: `string`

***

### kind

> **kind**: [`InterlockKind`](../type-aliases/InterlockKind.md)

***

### resources?

> `optional` **resources?**: [`ResourceId`](ResourceId.md)[]

Resources this interlock guards; omitted/empty = applies to every resource.

***

### safeState?

> `optional` **safeState?**: [`SafeState`](SafeState.md)

Fail-safe state to command when this interlock trips.

## Methods

### evaluate()

> **evaluate**(`ctx`): [`InterlockResult`](InterlockResult.md) \| `Promise`\<[`InterlockResult`](InterlockResult.md)\>

#### Parameters

##### ctx

[`InterlockContext`](InterlockContext.md)

#### Returns

[`InterlockResult`](InterlockResult.md) \| `Promise`\<[`InterlockResult`](InterlockResult.md)\>
