[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / MultiHopForwarderOptions

# Interface: MultiHopForwarderOptions

## Properties

### channels

> **channels**: `Map`\<`string`, [`OmniaChannel`](OmniaChannel.md)\>

This wallet's channels (updated in place).

***

### codec?

> `optional` **codec?**: `RoutingEnvelopeCodec`

Envelope codec; defaults to the cleartext codec.

***

### leaseProvider

> **leaseProvider**: `WotsLeaseProvider`

***

### onForward?

> `optional` **onForward?**: (`info`) => `void`

#### Parameters

##### info

###### hashlock

`string`

###### outChannelId

`string`

###### outHtlcId

`string`

###### via

`string`

#### Returns

`void`

***

### onSettled?

> `optional` **onSettled?**: (`info`) => `void`

#### Parameters

##### info

###### hashlock

`string`

###### inChannelId

`string`

###### inHtlcId

`string`

#### Returns

`void`

***

### signer

> **signer**: `ChannelSigner`

***

### swarm

> **swarm**: `OmniaSwarm`
