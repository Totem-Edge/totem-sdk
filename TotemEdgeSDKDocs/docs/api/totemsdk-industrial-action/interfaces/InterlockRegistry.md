[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / InterlockRegistry

# Interface: InterlockRegistry

## Methods

### evaluate()

> **evaluate**(`ctx`): `Promise`\<[`InterlockFailure`](InterlockFailure.md)[]\>

Evaluate all applicable interlocks; returns the failures (empty = all passed).

#### Parameters

##### ctx

[`InterlockContext`](InterlockContext.md)

#### Returns

`Promise`\<[`InterlockFailure`](InterlockFailure.md)[]\>

***

### forResource()

> **forResource**(`id`): [`Interlock`](Interlock.md)[]

Interlocks that guard a resource (including global ones).

#### Parameters

##### id

[`ResourceId`](ResourceId.md) \| `undefined`

#### Returns

[`Interlock`](Interlock.md)[]

***

### list()

> **list**(): [`Interlock`](Interlock.md)[]

#### Returns

[`Interlock`](Interlock.md)[]

***

### register()

> **register**(`interlock`): `void`

#### Parameters

##### interlock

[`Interlock`](Interlock.md)

#### Returns

`void`
