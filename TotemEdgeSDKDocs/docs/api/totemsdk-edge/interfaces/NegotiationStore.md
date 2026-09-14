[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / NegotiationStore

# Interface: NegotiationStore

A durable negotiation store with atomic CAS semantics.

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

[`NegotiationRecord`](NegotiationRecord.md)

#### Returns

`Promise`\<`boolean`\>

***

### create()

> **create**(`record`): `Promise`\<`void`\>

#### Parameters

##### record

[`NegotiationRecord`](NegotiationRecord.md)

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`negotiationId`): `Promise`\<[`NegotiationRecord`](NegotiationRecord.md) \| `undefined`\>

#### Parameters

##### negotiationId

`string`

#### Returns

`Promise`\<[`NegotiationRecord`](NegotiationRecord.md) \| `undefined`\>

***

### listRecoverable()?

> `optional` **listRecoverable**(): `Promise`\<[`NegotiationRecord`](NegotiationRecord.md)[]\>

List recoverable (non-terminal) negotiations.

#### Returns

`Promise`\<[`NegotiationRecord`](NegotiationRecord.md)[]\>

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

[`NegotiationRecord`](NegotiationRecord.md)

##### outboxMessages

[`OutboxMessage`](OutboxMessage.md)[]

#### Returns

`Promise`\<`boolean`\>
