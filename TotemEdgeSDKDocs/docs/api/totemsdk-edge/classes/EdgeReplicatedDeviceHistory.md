[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeReplicatedDeviceHistory

# Class: EdgeReplicatedDeviceHistory

## Constructors

### Constructor

> **new EdgeReplicatedDeviceHistory**(`log`): `EdgeReplicatedDeviceHistory`

#### Parameters

##### log

`ReplicatedLog`\<[`EdgeDeviceEvent`](../interfaces/EdgeDeviceEvent.md)\>

#### Returns

`EdgeReplicatedDeviceHistory`

## Methods

### append()

> **append**(`event`): `Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

#### Parameters

##### event

[`EdgeDeviceEvent`](../interfaces/EdgeDeviceEvent.md)

#### Returns

`Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### readSince()

> **readSince**(`cursor?`): `AsyncIterable`\<\{ `cursor`: `string`; `record`: [`EdgeDeviceEvent`](../interfaces/EdgeDeviceEvent.md); \}\>

#### Parameters

##### cursor?

`string`

#### Returns

`AsyncIterable`\<\{ `cursor`: `string`; `record`: [`EdgeDeviceEvent`](../interfaces/EdgeDeviceEvent.md); \}\>

***

### status()

> **status**(): `ReplicationStatus`

#### Returns

`ReplicationStatus`
