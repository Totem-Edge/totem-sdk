[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttUsageMeter

# Interface: MqttUsageMeter

## Methods

### createUsageReceipt()

> **createUsageReceipt**(`event`): `EdgeReceipt`

#### Parameters

##### event

[`MqttUsageEvent`](MqttUsageEvent.md)

#### Returns

`EdgeReceipt`

***

### getUnpaidUsage()

> **getUnpaidUsage**(): `string`

#### Returns

`string`

***

### recordUsage()

> **recordUsage**(`event`): `Promise`\<`EdgeOperationResult`\<`unknown`\>\>

#### Parameters

##### event

[`MqttUsageEvent`](MqttUsageEvent.md)

#### Returns

`Promise`\<`EdgeOperationResult`\<`unknown`\>\>

***

### resetUsage()

> **resetUsage**(): `void`

#### Returns

`void`

***

### settle()

> **settle**(`recipient`): `Promise`\<`EdgeOperationResult`\<\{ `settled`: `string`; `txpowId?`: `string`; \}\>\>

Pay the accumulated unpaid usage to `recipient` via runtime.ports.payment.
Resets the usage counter on success. No-ops (ok:true) when usage is zero.
Returns ok:false when no payment port is configured.

#### Parameters

##### recipient

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `settled`: `string`; `txpowId?`: `string`; \}\>\>
