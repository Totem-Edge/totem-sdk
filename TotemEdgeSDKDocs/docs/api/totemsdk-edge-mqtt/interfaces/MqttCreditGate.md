[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttCreditGate

# Interface: MqttCreditGate

## Methods

### checkCredit()

> **checkCredit**(): `Promise`\<[`MqttCreditDecision`](MqttCreditDecision.md)\>

#### Returns

`Promise`\<[`MqttCreditDecision`](MqttCreditDecision.md)\>

***

### gatePublish()

> **gatePublish**(`topic`, `payload`, `options?`): `Promise`\<`EdgeOperationResult`\>

#### Parameters

##### topic

`string`

##### payload

`string` \| `Uint8Array`\<`ArrayBufferLike`\>

##### options?

[`MqttPublishOptions`](MqttPublishOptions.md)

#### Returns

`Promise`\<`EdgeOperationResult`\>

***

### getUnpaidUsage()

> **getUnpaidUsage**(): `string`

#### Returns

`string`

***

### publishShutdownNotice()

> **publishShutdownNotice**(`reason`): `Promise`\<`void`\>

#### Parameters

##### reason

`string`

#### Returns

`Promise`\<`void`\>

***

### recordUsage()

> **recordUsage**(`quantity`): `void`

Record usage directly on the gate, accumulating toward the limit.
Call this when not using an external usage meter via config.getUsage.

#### Parameters

##### quantity

`string`

#### Returns

`void`
