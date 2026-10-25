[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / Resource

# Interface: Resource

## Properties

### addresses

> **addresses**: [`ResourceAddress`](ResourceAddress.md)[]

***

### id

> **id**: [`ResourceId`](ResourceId.md)

***

### kind

> **kind**: [`ResourceKind`](../type-aliases/ResourceKind.md)

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### safeState?

> `optional` **safeState?**: [`SafeState`](SafeState.md)

Declared safe state (required for `fail-safe`/`fail-closed` resources).
