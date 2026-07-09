[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / WebSocketClient

# Interface: WebSocketClient

## Properties

### onclose

> **onclose**: ((`ev`) => `void`) \| `null`

***

### onerror

> **onerror**: ((`ev`) => `void`) \| `null`

***

### onmessage

> **onmessage**: ((`ev`) => `void`) \| `null`

***

### onopen

> **onopen**: ((`ev`) => `void`) \| `null`

***

### readyState

> `readonly` **readyState**: `number`

***

### url

> `readonly` **url**: `string`

## Methods

### addEventListener()

> **addEventListener**\<`K`\>(`event`, `listener`): `void`

#### Type Parameters

##### K

`K` *extends* keyof [`WebSocketEventMap`](../type-aliases/WebSocketEventMap.md)

#### Parameters

##### event

`K`

##### listener

(`ev`) => `void`

#### Returns

`void`

***

### close()

> **close**(`code?`, `reason?`): `void`

#### Parameters

##### code?

`number`

##### reason?

`string`

#### Returns

`void`

***

### removeAllListeners()

> **removeAllListeners**(): `void`

#### Returns

`void`

***

### removeEventListener()

> **removeEventListener**\<`K`\>(`event`, `listener`): `void`

#### Type Parameters

##### K

`K` *extends* keyof [`WebSocketEventMap`](../type-aliases/WebSocketEventMap.md)

#### Parameters

##### event

`K`

##### listener

(`ev`) => `void`

#### Returns

`void`

***

### send()

> **send**(`data`): `void`

#### Parameters

##### data

`string` \| [`BinaryData`](../type-aliases/BinaryData.md)

#### Returns

`void`

***

### terminate()

> **terminate**(): `void`

#### Returns

`void`
