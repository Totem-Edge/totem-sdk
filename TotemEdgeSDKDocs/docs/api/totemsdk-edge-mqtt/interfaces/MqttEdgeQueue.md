[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttEdgeQueue

# Interface: MqttEdgeQueue

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

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

### size()

> **size**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>
