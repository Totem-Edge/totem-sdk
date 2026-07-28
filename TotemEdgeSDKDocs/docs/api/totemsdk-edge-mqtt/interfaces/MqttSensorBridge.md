[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttSensorBridge

# Interface: MqttSensorBridge

## Methods

### handleMessage()

> **handleMessage**(`message`): `Promise`\<`void`\>

#### Parameters

##### message

[`MqttMessage`](MqttMessage.md)

#### Returns

`Promise`\<`void`\>

***

### handleSensorMessage()

> **handleSensorMessage**(`binding`, `message`): `Promise`\<`void`\>

#### Parameters

##### binding

[`MqttSensorBinding`](MqttSensorBinding.md)

##### message

[`MqttMessage`](MqttMessage.md)

#### Returns

`Promise`\<`void`\>

***

### start()

> **start**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
