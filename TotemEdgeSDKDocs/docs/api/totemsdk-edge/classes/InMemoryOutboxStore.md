[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / InMemoryOutboxStore

# Class: InMemoryOutboxStore

In-memory outbox (dev/test).

## Implements

- [`OutboxStore`](../interfaces/OutboxStore.md)

## Constructors

### Constructor

> **new InMemoryOutboxStore**(): `InMemoryOutboxStore`

#### Returns

`InMemoryOutboxStore`

## Methods

### enqueue()

> **enqueue**(`entry`): `Promise`\<`void`\>

Atomically enqueue an outbound message.

#### Parameters

##### entry

[`OutboxEntry`](../interfaces/OutboxEntry.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`OutboxStore`](../interfaces/OutboxStore.md).[`enqueue`](../interfaces/OutboxStore.md#enqueue)

***

### listUndelivered()

> **listUndelivered**(): `Promise`\<[`OutboxEntry`](../interfaces/OutboxEntry.md)[]\>

List undelivered entries (for resend on restart).

#### Returns

`Promise`\<[`OutboxEntry`](../interfaces/OutboxEntry.md)[]\>

#### Implementation of

[`OutboxStore`](../interfaces/OutboxStore.md).[`listUndelivered`](../interfaces/OutboxStore.md#listundelivered)

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

#### Implementation of

[`OutboxStore`](../interfaces/OutboxStore.md).[`markDelivered`](../interfaces/OutboxStore.md#markdelivered)

***

### recordAttempt()

> **recordAttempt**(`messageId`): `Promise`\<`void`\>

Increment the delivery attempt count.

#### Parameters

##### messageId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`OutboxStore`](../interfaces/OutboxStore.md).[`recordAttempt`](../interfaces/OutboxStore.md#recordattempt)
