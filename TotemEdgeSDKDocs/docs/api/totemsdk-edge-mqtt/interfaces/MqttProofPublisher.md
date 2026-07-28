[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttProofPublisher

# Interface: MqttProofPublisher

## Methods

### createProofFromMessage()

> **createProofFromMessage**(`message`, `options?`): `Promise`\<[`MqttProofEnvelope`](MqttProofEnvelope.md)\>

#### Parameters

##### message

[`MqttMessage`](MqttMessage.md)

##### options?

[`MqttProofOptions`](MqttProofOptions.md)

#### Returns

`Promise`\<[`MqttProofEnvelope`](MqttProofEnvelope.md)\>

***

### publishProof()

> **publishProof**(`envelope`, `topic?`): `Promise`\<`void`\>

#### Parameters

##### envelope

[`MqttProofEnvelope`](MqttProofEnvelope.md)

##### topic?

`string`

#### Returns

`Promise`\<`void`\>

***

### publishProofReceipt()

> **publishProofReceipt**(`envelope`, `topic?`): `Promise`\<`void`\>

#### Parameters

##### envelope

[`MqttProofEnvelope`](MqttProofEnvelope.md)

##### topic?

`string`

#### Returns

`Promise`\<`void`\>
