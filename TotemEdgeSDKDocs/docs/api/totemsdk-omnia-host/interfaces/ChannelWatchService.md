[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / ChannelWatchService

# Interface: ChannelWatchService

## Methods

### runOnce()

> **runOnce**(): `Promise`\<[`WatchFinding`](WatchFinding.md)[]\>

Compute findings and run the configured actions.

#### Returns

`Promise`\<[`WatchFinding`](WatchFinding.md)[]\>

***

### scan()

> **scan**(): `Promise`\<[`WatchFinding`](WatchFinding.md)[]\>

Compute findings without running actions.

#### Returns

`Promise`\<[`WatchFinding`](WatchFinding.md)[]\>

***

### start()

> **start**(`intervalMs?`): `void`

Poll periodically. Returns immediately; call `stop()` to end.

#### Parameters

##### intervalMs?

`number`

#### Returns

`void`

***

### stop()

> **stop**(): `void`

#### Returns

`void`
