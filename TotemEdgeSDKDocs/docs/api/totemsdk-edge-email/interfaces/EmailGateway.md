[**@totemsdk/edge-email**](../index.md)

***

[@totemsdk/edge-email](../index.md) / EmailGateway

# Interface: EmailGateway

## Properties

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

## Methods

### deleteMessage()

> **deleteMessage**(`mailbox`, `id`): `Promise`\<`EdgeOperationResult`\>

#### Parameters

##### mailbox

`string`

##### id

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\>

***

### listMailboxes()

> **listMailboxes**(): `Promise`\<`EdgeOperationResult`\<\{ `mailboxes`: `object`[]; \}\>\>

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `mailboxes`: `object`[]; \}\>\>

***

### markAsRead()

> **markAsRead**(`mailbox`, `id`): `Promise`\<`EdgeOperationResult`\>

#### Parameters

##### mailbox

`string`

##### id

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\>

***

### moveMessage()

> **moveMessage**(`mailbox`, `id`, `destination`): `Promise`\<`EdgeOperationResult`\>

#### Parameters

##### mailbox

`string`

##### id

`string`

##### destination

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\>

***

### readMessage()

> **readMessage**(`mailbox`, `id`): `Promise`\<`EdgeOperationResult`\<\{ `message`: [`EmailMessage`](EmailMessage.md); \}\>\>

#### Parameters

##### mailbox

`string`

##### id

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `message`: [`EmailMessage`](EmailMessage.md); \}\>\>

***

### searchMessages()

> **searchMessages**(`options`): `Promise`\<`EdgeOperationResult`\<\{ `messages`: [`EmailMessage`](EmailMessage.md)[]; `total`: `number`; \}\>\>

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

###### query?

`string`

###### since?

`Date`

###### subject?

`string`

###### unreadOnly?

`boolean`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `messages`: [`EmailMessage`](EmailMessage.md)[]; `total`: `number`; \}\>\>

***

### sendMail()

> **sendMail**(`options`): `Promise`\<`EdgeOperationResult`\<\{ `messageId`: `string`; \}\>\>

#### Parameters

##### options

[`SendOptions`](SendOptions.md)

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `messageId`: `string`; \}\>\>

***

### start()

> **start**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
