[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / WatchChainView

# Interface: WatchChainView

## Methods

### getCoin()

> **getCoin**(`coinId`): `Promise`\<\{ `created?`: `string` \| `number`; `spent?`: `boolean`; \} \| `null`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<\{ `created?`: `string` \| `number`; `spent?`: `boolean`; \} \| `null`\>

***

### getSuccessor()?

> `optional` **getSuccessor**(`channel`): `Promise`\<\{ `coinId`: `string`; \} \| `null`\>

The current unspent coin at the channel's funding address, if any.

CAN-014: a spent funding coin is not by itself a close — a state update or
a splice also spends it and creates a successor. When this hook is provided
a spent coin with a successor is treated as continuity, not closure.

#### Parameters

##### channel

`OmniaChannel`

#### Returns

`Promise`\<\{ `coinId`: `string`; \} \| `null`\>

***

### getTip()

> **getTip**(): `Promise`\<\{ `block`: `number`; \}\>

#### Returns

`Promise`\<\{ `block`: `number`; \}\>
