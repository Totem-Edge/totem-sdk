[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / ChannelSnapshotStore

# Interface: ChannelSnapshotStore

Minimal keyed snapshot store for channel persistence.

## Extended by

- [`DurableChannelSnapshotStore`](DurableChannelSnapshotStore.md)

## Methods

### get()

> **get**(`channelId`): `string` \| `Promise`\<`string` \| `undefined`\> \| `undefined`

#### Parameters

##### channelId

`string`

#### Returns

`string` \| `Promise`\<`string` \| `undefined`\> \| `undefined`

***

### set()?

> `optional` **set**(`channelId`, `snapshot`): `void` \| `Promise`\<`void`\>

#### Parameters

##### channelId

`string`

##### snapshot

`string`

#### Returns

`void` \| `Promise`\<`void`\>
