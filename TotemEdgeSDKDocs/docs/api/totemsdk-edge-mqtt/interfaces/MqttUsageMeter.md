[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttUsageMeter

# Interface: MqttUsageMeter

## Methods

### createUsageReceipt()

> **createUsageReceipt**(`event`): `any`

#### Parameters

##### event

[`MqttUsageEvent`](MqttUsageEvent.md)

#### Returns

`any`

***

### getUnpaidUsage()

> **getUnpaidUsage**(): `string`

#### Returns

`string`

***

### recordUsage()

> **recordUsage**(`event`): `Promise`\<`EdgeOperationResult`\>

#### Parameters

##### event

[`MqttUsageEvent`](MqttUsageEvent.md)

#### Returns

`Promise`\<`EdgeOperationResult`\>

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
