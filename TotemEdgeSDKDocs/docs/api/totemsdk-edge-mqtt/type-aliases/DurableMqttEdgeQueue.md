[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / DurableMqttEdgeQueue

# Type Alias: DurableMqttEdgeQueue

> **DurableMqttEdgeQueue** = [`MqttEdgeQueue`](../interfaces/MqttEdgeQueue.md) & `object`

Durable queue surface plus dead-letter observability.

## Type Declaration

### ack()

> **ack**(`id`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

### deadLetter()

> **deadLetter**(`id`, `reason?`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

##### reason?

`string`

#### Returns

`Promise`\<`void`\>

### deadLetterCount()

> **deadLetterCount**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

### recoverInFlight()

> **recoverInFlight**(`maxAgeMs?`): `Promise`\<`number`\>

#### Parameters

##### maxAgeMs?

`number`

#### Returns

`Promise`\<`number`\>

### release()

> **release**(`id`, `options?`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

##### options?

`MqttQueueReleaseOptions`

#### Returns

`Promise`\<`void`\>
