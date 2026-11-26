[**@totemsdk/edge-gnss**](../index.md)

***

[@totemsdk/edge-gnss](../index.md) / GnssGateway

# Interface: GnssGateway

## Properties

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

## Methods

### getFix()

> **getFix**(): `Promise`\<`EdgeOperationResult`\<\{ `fix`: [`GnssFix`](GnssFix.md); \}\>\>

Latest valid fix, or a failure when none is available.

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `fix`: [`GnssFix`](GnssFix.md); \}\>\>

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
