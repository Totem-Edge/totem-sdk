[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / DurableChannelSnapshotStore

# Interface: DurableChannelSnapshotStore

Minimal keyed snapshot store for channel persistence.

## Extends

- [`ChannelSnapshotStore`](ChannelSnapshotStore.md)

## Methods

### get()

> **get**(`channelId`): `string` \| `Promise`\<`string` \| `undefined`\> \| `undefined`

#### Parameters

##### channelId

`string`

#### Returns

`string` \| `Promise`\<`string` \| `undefined`\> \| `undefined`

#### Inherited from

[`ChannelSnapshotStore`](ChannelSnapshotStore.md).[`get`](ChannelSnapshotStore.md#get)

***

### has()

> **has**(`channelId`): `Promise`\<`boolean`\>

#### Parameters

##### channelId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### keys()

> **keys**(): `Promise`\<`string`[]\>

Channel ids that currently have a persisted snapshot.

#### Returns

`Promise`\<`string`[]\>

***

### remove()

> **remove**(`channelId`): `Promise`\<`boolean`\>

#### Parameters

##### channelId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### set()

> **set**(`channelId`, `snapshot`): `Promise`\<`void`\>

#### Parameters

##### channelId

`string`

##### snapshot

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`ChannelSnapshotStore`](ChannelSnapshotStore.md).[`set`](ChannelSnapshotStore.md#set)
