[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / InMemoryNegotiationStore

# Class: InMemoryNegotiationStore

In-memory negotiation store. No crash guarantees — for development and
tests only. Production must supply a durable implementation.

## Implements

- [`NegotiationStore`](../interfaces/NegotiationStore.md)

## Constructors

### Constructor

> **new InMemoryNegotiationStore**(`outbox?`): `InMemoryNegotiationStore`

#### Parameters

##### outbox?

[`OutboxStore`](../interfaces/OutboxStore.md)

#### Returns

`InMemoryNegotiationStore`

## Methods

### compareAndSet()

> **compareAndSet**(`negotiationId`, `expectedRevision`, `next`): `Promise`\<`boolean`\>

Atomically replace the record only if its current revision equals
`expectedRevision`. Returns false when the record was advanced by
another writer (stale transition).

#### Parameters

##### negotiationId

`string`

##### expectedRevision

`number`

##### next

[`NegotiationRecord`](../interfaces/NegotiationRecord.md)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`NegotiationStore`](../interfaces/NegotiationStore.md).[`compareAndSet`](../interfaces/NegotiationStore.md#compareandset)

***

### create()

> **create**(`record`): `Promise`\<`void`\>

#### Parameters

##### record

[`NegotiationRecord`](../interfaces/NegotiationRecord.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`NegotiationStore`](../interfaces/NegotiationStore.md).[`create`](../interfaces/NegotiationStore.md#create)

***

### get()

> **get**(`negotiationId`): `Promise`\<[`NegotiationRecord`](../interfaces/NegotiationRecord.md) \| `undefined`\>

#### Parameters

##### negotiationId

`string`

#### Returns

`Promise`\<[`NegotiationRecord`](../interfaces/NegotiationRecord.md) \| `undefined`\>

#### Implementation of

[`NegotiationStore`](../interfaces/NegotiationStore.md).[`get`](../interfaces/NegotiationStore.md#get)

***

### getOutbox()

> **getOutbox**(): [`OutboxStore`](../interfaces/OutboxStore.md)

Expose the outbox read/write surface (dev mode + tests).

#### Returns

[`OutboxStore`](../interfaces/OutboxStore.md)

***

### listRecoverable()

> **listRecoverable**(): `Promise`\<[`NegotiationRecord`](../interfaces/NegotiationRecord.md)[]\>

List recoverable (non-terminal) negotiations.

#### Returns

`Promise`\<[`NegotiationRecord`](../interfaces/NegotiationRecord.md)[]\>

#### Implementation of

[`NegotiationStore`](../interfaces/NegotiationStore.md).[`listRecoverable`](../interfaces/NegotiationStore.md#listrecoverable)

***

### listUndelivered()

> **listUndelivered**(): `Promise`\<[`OutboxEntry`](../interfaces/OutboxEntry.md)[]\>

#### Returns

`Promise`\<[`OutboxEntry`](../interfaces/OutboxEntry.md)[]\>

***

### markOutboxDelivered()

> **markOutboxDelivered**(`messageId`): `Promise`\<`void`\>

#### Parameters

##### messageId

`string`

#### Returns

`Promise`\<`void`\>

***

### transitionAndEnqueue()

> **transitionAndEnqueue**(`negotiationId`, `expectedRevision`, `next`, `outboxMessages`): `Promise`\<`boolean`\>

Atomically perform a negotiation CAS AND enqueue outbox messages in ONE
durable transaction. Returns false when the CAS failed (stale revision).

For SQLite/Postgres this MUST be a single DB transaction so that the
economic transition and the protocol response commit or fail together.

The default falls back to a two-step (non-transactional) sequence. A
durable store MUST override this to keep the crash window closed.

#### Parameters

##### negotiationId

`string`

##### expectedRevision

`number`

##### next

[`NegotiationRecord`](../interfaces/NegotiationRecord.md)

##### outboxMessages

[`OutboxMessage`](../interfaces/OutboxMessage.md)[]

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`NegotiationStore`](../interfaces/NegotiationStore.md).[`transitionAndEnqueue`](../interfaces/NegotiationStore.md#transitionandenqueue)
