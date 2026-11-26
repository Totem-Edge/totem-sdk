[**@totemsdk/edge-gnss**](../index.md)

***

[@totemsdk/edge-gnss](../index.md) / GnssTransportPort

# Interface: GnssTransportPort

## Methods

### getFix()

> **getFix**(): `Promise`\<[`GnssFix`](GnssFix.md) \| `null`\>

Latest known fix, or null when no fix is available.

#### Returns

`Promise`\<[`GnssFix`](GnssFix.md) \| `null`\>

***

### onError()

> **onError**(`handler`): () => `void`

Register a handler for receiver errors.

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

***

### onFix()

> **onFix**(`handler`): () => `void`

Register a handler for fix updates.

#### Parameters

##### handler

(`fix`) => `void`

#### Returns

() => `void`

***

### start()

> **start**(): `Promise`\<`void`\>

Start the receiver / location stream.

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

Stop the receiver and release resources.

#### Returns

`Promise`\<`void`\>
