[**@totemsdk/edge-email**](../index.md)

***

[@totemsdk/edge-email](../index.md) / EmailTransportPort

# Interface: EmailTransportPort

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### connect()

> **connect**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### deleteMessage()

> **deleteMessage**(`mailbox`, `id`): `Promise`\<`void`\>

#### Parameters

##### mailbox

`string`

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### listMailboxes()

> **listMailboxes**(): `Promise`\<`object`[]\>

#### Returns

`Promise`\<`object`[]\>

***

### markAsRead()

> **markAsRead**(`mailbox`, `id`): `Promise`\<`void`\>

#### Parameters

##### mailbox

`string`

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### moveMessage()

> **moveMessage**(`mailbox`, `id`, `destinationMailbox`): `Promise`\<`void`\>

#### Parameters

##### mailbox

`string`

##### id

`string`

##### destinationMailbox

`string`

#### Returns

`Promise`\<`void`\>

***

### onError()

> **onError**(`handler`): () => `void`

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

***

### onNewMessage()

> **onNewMessage**(`handler`): () => `void`

#### Parameters

##### handler

(`mailbox`, `message`) => `void`

#### Returns

() => `void`

***

### readMessage()

> **readMessage**(`mailbox`, `id`): `Promise`\<[`EmailMessage`](EmailMessage.md)\>

#### Parameters

##### mailbox

`string`

##### id

`string`

#### Returns

`Promise`\<[`EmailMessage`](EmailMessage.md)\>

***

### searchMessages()

> **searchMessages**(`options`): `Promise`\<\{ `messages`: [`EmailMessage`](EmailMessage.md)[]; `total`: `number`; \}\>

#### Parameters

##### options

###### before?

`Date`

###### from?

`string`

###### limit?

`number`

###### mailbox?

`string`

###### page?

`number`

###### query?

`string`

###### since?

`Date`

###### subject?

`string`

###### to?

`string`

###### unreadOnly?

`boolean`

#### Returns

`Promise`\<\{ `messages`: [`EmailMessage`](EmailMessage.md)[]; `total`: `number`; \}\>

***

### sendMail()

> **sendMail**(`options`): `Promise`\<\{ `messageId`: `string`; \}\>

#### Parameters

##### options

[`SendOptions`](SendOptions.md)

#### Returns

`Promise`\<\{ `messageId`: `string`; \}\>
