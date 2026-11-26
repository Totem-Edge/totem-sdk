[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / ChannelWatchOptions

# Interface: ChannelWatchOptions

## Properties

### chain

> **chain**: [`WatchChainView`](WatchChainView.md)

***

### channels

> **channels**: `Map`\<`string`, `OmniaChannel`\>

***

### htlcLeadBlocks?

> `optional` **htlcLeadBlocks?**: `number`

Warn this many blocks before an HTLC timeout. Default 12.

***

### maxAttempts?

> `optional` **maxAttempts?**: `number`

Bounded retry attempts per finding. Default 3.

***

### onHtlcExpiring?

> `optional` **onHtlcExpiring?**: (`channel`, `htlc`, `finding`) => `void` \| `Promise`\<`void`\>

Invoked for each pending HTLC inside the lead window.

#### Parameters

##### channel

`OmniaChannel`

##### htlc

`HTLCRecord`

##### finding

[`WatchFinding`](WatchFinding.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### onUnilateralClose?

> `optional` **onUnilateralClose?**: (`channel`, `finding`) => `void` \| `Promise`\<`void`\>

Invoked once per detected close (per channel) until it succeeds.

#### Parameters

##### channel

`OmniaChannel`

##### finding

[`WatchFinding`](WatchFinding.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### retryDelayMs?

> `optional` **retryDelayMs?**: `number`

Base backoff between attempts. Default 250ms.

***

### sleep?

> `optional` **sleep?**: (`ms`) => `Promise`\<`void`\>

Clock/sleep injection for tests.

#### Parameters

##### ms

`number`

#### Returns

`Promise`\<`void`\>

***

### storage?

> `optional` **storage?**: `StorageAdapter`

Durable cursor/processed-finding store. Optional; in-memory by default.
