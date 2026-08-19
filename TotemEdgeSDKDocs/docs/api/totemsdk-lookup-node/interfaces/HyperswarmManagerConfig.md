[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / HyperswarmManagerConfig

# Interface: HyperswarmManagerConfig

## Properties

### announce?

> `optional` **announce?**: `boolean`

If true, the manager also announces on the topic (server mode).
If false, it only joins to discover peers (client mode).
Default: true

***

### lookup?

> `optional` **lookup?**: `boolean`

If true, the manager looks up peers on the topic.
Default: true

***

### swarm

> **swarm**: `any`

Hyperswarm instance to use. Must be created by the caller so that
key material and DHT configuration remain under application control.
```ts
import Hyperswarm from 'hyperswarm';
const swarm = new Hyperswarm();
```

***

### topic

> **topic**: `string` \| `Buffer`\<`ArrayBufferLike`\>

Topic to announce and join. Should be a 32-byte Buffer derived from
a well-known string (e.g. `crypto.createHash('sha256').update('totem-lookup-v1').digest()`).
