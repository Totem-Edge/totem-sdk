[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / ApprovalQueue

# Interface: ApprovalQueue\<T\>

## Type Parameters

### T

`T`

## Methods

### cancelAll()

> **cancelAll**(): `void`

Deny every outstanding request (teardown / lock).

#### Returns

`void`

***

### enqueue()

> **enqueue**(`request`): `Promise`\<`boolean`\>

Append a request; resolves once the user (or the timeout) decides.

#### Parameters

##### request

`T`

#### Returns

`Promise`\<`boolean`\>

***

### pending()

> **pending**(): `T` \| `null`

The request the UI should show now, if any.

#### Returns

`T` \| `null`

***

### resolve()

> **resolve**(`approved`): `boolean`

Answer the head request. Returns false when nothing was pending.

#### Parameters

##### approved

`boolean`

#### Returns

`boolean`

***

### size()

> **size**(): `number`

Number of requests waiting, including the one on screen.

#### Returns

`number`
