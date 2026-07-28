[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttClientPort

# Interface: MqttClientPort

## Methods

### connect()?

> `optional` **connect**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### disconnect()?

> `optional` **disconnect**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### onMessage()

> **onMessage**(`handler`): () => `void`

#### Parameters

##### handler

(`message`) => `void` \| `Promise`\<`void`\>

#### Returns

() => `void`

***

### publish()

> **publish**(`topic`, `payload`, `options?`): `Promise`\<`void`\>

#### Parameters

##### topic

`string`

##### payload

`string` \| `Uint8Array`\<`ArrayBufferLike`\>

##### options?

[`MqttPublishOptions`](MqttPublishOptions.md)

#### Returns

`Promise`\<`void`\>

***

### subscribe()

> **subscribe**(`topic`, `options?`): `Promise`\<[`MqttSubscription`](MqttSubscription.md)\>

#### Parameters

##### topic

`string`

##### options?

[`MqttSubscribeOptions`](MqttSubscribeOptions.md)

#### Returns

`Promise`\<[`MqttSubscription`](MqttSubscription.md)\>

***

### unsubscribe()?

> `optional` **unsubscribe**(`topic`): `Promise`\<`void`\>

#### Parameters

##### topic

`string`

#### Returns

`Promise`\<`void`\>
