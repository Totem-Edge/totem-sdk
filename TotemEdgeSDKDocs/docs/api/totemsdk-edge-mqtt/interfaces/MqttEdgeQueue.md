[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttEdgeQueue

# Interface: MqttEdgeQueue

Claim/ack/retry queue contract (RFC-007 G4).

`dequeue()` claims an event; the event is only forgotten after `ack()`.
`release()` returns a claimed event to pending for retry, and `deadLetter()`
removes a claimed event from the active queue while durably recording it.
A crash between `dequeue()` and `ack()` leaves the claim durable, so
`recoverInFlight()` on startup re-delivers rather than loses.

## Methods

### ack()?

> `optional` **ack**(`id`): `Promise`\<`void`\>

Durable acknowledgment — forget the event after it has been published.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### deadLetter()?

> `optional` **deadLetter**(`id`, `reason?`): `Promise`\<`void`\>

Move a claimed event into the durable dead-letter set (never re-delivered).

#### Parameters

##### id

`string`

##### reason?

`string`

#### Returns

`Promise`\<`void`\>

***

### dequeue()

> **dequeue**(): `Promise`\<[`MqttQueuedEvent`](MqttQueuedEvent.md) \| `undefined`\>

#### Returns

`Promise`\<[`MqttQueuedEvent`](MqttQueuedEvent.md) \| `undefined`\>

***

### enqueue()

> **enqueue**(`event`): `Promise`\<`void`\>

#### Parameters

##### event

[`MqttQueuedEvent`](MqttQueuedEvent.md)

#### Returns

`Promise`\<`void`\>

***

### peek()

> **peek**(): `Promise`\<[`MqttQueuedEvent`](MqttQueuedEvent.md) \| `undefined`\>

#### Returns

`Promise`\<[`MqttQueuedEvent`](MqttQueuedEvent.md) \| `undefined`\>

***

### recoverInFlight()?

> `optional` **recoverInFlight**(`maxAgeMs?`): `Promise`\<`number`\>

Reset any in-flight (claimed-but-unacked) events back to pending so they
re-deliver after a crash. Returns the number recovered.

#### Parameters

##### maxAgeMs?

`number`

#### Returns

`Promise`\<`number`\>

***

### release()?

> `optional` **release**(`id`, `options?`): `Promise`\<`void`\>

Return a claimed event to pending for a later retry attempt.

#### Parameters

##### id

`string`

##### options?

`MqttQueueReleaseOptions`

#### Returns

`Promise`\<`void`\>

***

### size()

> **size**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>
