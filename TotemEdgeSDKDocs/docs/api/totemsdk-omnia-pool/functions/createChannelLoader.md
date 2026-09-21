[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / createChannelLoader

# Function: createChannelLoader()

> **createChannelLoader**(`store`): (`channelId`) => `Promise`\<`OmniaChannel`\>

Build a `loadChannel(channelId)` port that reads a persisted channel snapshot
and recovers the live `OmniaChannel` object.

## Parameters

### store

[`ChannelSnapshotStore`](../interfaces/ChannelSnapshotStore.md)

## Returns

(`channelId`) => `Promise`\<`OmniaChannel`\>
