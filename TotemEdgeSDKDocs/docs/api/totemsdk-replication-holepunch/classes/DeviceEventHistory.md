[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / DeviceEventHistory

# Class: DeviceEventHistory

## Constructors

### Constructor

> **new DeviceEventHistory**(`log`): `DeviceEventHistory`

#### Parameters

##### log

`ReplicatedLog`\<[`DeviceEvent`](../interfaces/DeviceEvent.md)\>

#### Returns

`DeviceEventHistory`

## Methods

### append()

> **append**(`event`): `Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

#### Parameters

##### event

[`DeviceEvent`](../interfaces/DeviceEvent.md)

#### Returns

`Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### readSince()

> **readSince**(`cursor?`): `AsyncIterable`\<\{ `cursor`: `string`; `record`: [`DeviceEvent`](../interfaces/DeviceEvent.md); \}\>

#### Parameters

##### cursor?

`string`

#### Returns

`AsyncIterable`\<\{ `cursor`: `string`; `record`: [`DeviceEvent`](../interfaces/DeviceEvent.md); \}\>

***

### status()

> **status**(): `ReplicationStatus`

#### Returns

`ReplicationStatus`
