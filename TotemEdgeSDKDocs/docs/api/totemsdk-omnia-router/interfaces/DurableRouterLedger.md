[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / DurableRouterLedger

# Interface: DurableRouterLedger

## Methods

### getRevision()

> **getRevision**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

***

### getSettled()

> **getSettled**(`channelId`, `htlcId`): `Promise`\<[`SettledSegment`](SettledSegment.md) \| `undefined`\>

Retrieve a previously settled segment.

#### Parameters

##### channelId

`string`

##### htlcId

`string`

#### Returns

`Promise`\<[`SettledSegment`](SettledSegment.md) \| `undefined`\>

***

### getSnapshot()

> **getSnapshot**(): `Promise`\<[`RouterLedgerState`](RouterLedgerState.md)\>

#### Returns

`Promise`\<[`RouterLedgerState`](RouterLedgerState.md)\>

***

### hasState()

> **hasState**(): `Promise`\<`boolean`\>

#### Returns

`Promise`\<`boolean`\>

***

### isSettled()

> **isSettled**(`channelId`, `htlcId`): `Promise`\<`boolean`\>

True when the given channel+HTLC already settled.

#### Parameters

##### channelId

`string`

##### htlcId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### listSettled()

> **listSettled**(`channelId?`): `Promise`\<[`SettledSegment`](SettledSegment.md)[]\>

All settled segments, optionally filtered by channel.

#### Parameters

##### channelId?

`string`

#### Returns

`Promise`\<[`SettledSegment`](SettledSegment.md)[]\>

***

### markReconciled()

> **markReconciled**(`channelId`, `htlcId`): `Promise`\<`void`\>

Mark a settled segment as reconciled with the route state.

#### Parameters

##### channelId

`string`

##### htlcId

`string`

#### Returns

`Promise`\<`void`\>

***

### recordSettled()

> **recordSettled**(`segment`): `Promise`\<`void`\>

Idempotently record a settled segment. Re-recording the same segment is a no-op.

#### Parameters

##### segment

[`SettledSegment`](SettledSegment.md)

#### Returns

`Promise`\<`void`\>
