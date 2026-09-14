[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / OutboxStore

# Interface: OutboxStore

A durable outbox store.

## Methods

### enqueue()

> **enqueue**(`entry`): `Promise`\<`void`\>

Atomically enqueue an outbound message.

#### Parameters

##### entry

[`OutboxEntry`](OutboxEntry.md)

#### Returns

`Promise`\<`void`\>

***

### listUndelivered()

> **listUndelivered**(): `Promise`\<[`OutboxEntry`](OutboxEntry.md)[]\>

List undelivered entries (for resend on restart).

#### Returns

`Promise`\<[`OutboxEntry`](OutboxEntry.md)[]\>

***

### markDelivered()

> **markDelivered**(`messageId`, `deliveredAt`): `Promise`\<`void`\>

Mark a message as delivered.

#### Parameters

##### messageId

`string`

##### deliveredAt

`number`

#### Returns

`Promise`\<`void`\>

***

### recordAttempt()

> **recordAttempt**(`messageId`): `Promise`\<`void`\>

Increment the delivery attempt count.

#### Parameters

##### messageId

`string`

#### Returns

`Promise`\<`void`\>
