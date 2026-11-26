[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / WalletForwardingOptions

# Interface: WalletForwardingOptions

## Properties

### chainProvider

> **chainProvider**: `ChainStateProvider`

***

### channels

> **channels**: `Map`\<`string`, [`OmniaChannel`](OmniaChannel.md)\>

The wallet's live channels; the forwarder updates them in place.

***

### codec?

> `optional` **codec?**: `RoutingEnvelopeCodec`

***

### leaseProvider

> **leaseProvider**: `WotsLeaseProvider`

***

### linkJournal

> **linkJournal**: [`HtlcLinkJournal`](HtlcLinkJournal.md)

Durable journal; a volatile one would strand locked liquidity on restart.

***

### onError?

> `optional` **onError?**: (`info`) => `void`

Observability hook; never used for control flow.

#### Parameters

##### info

[`WalletForwardingError`](WalletForwardingError.md)

#### Returns

`void`

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

### resolvePreimage?

> `optional` **resolvePreimage?**: (`hashlock`) => `string` \| `Promise`\<`string` \| `undefined`\> \| `undefined`

Recipient-side preimage resolver. Wallets usually resolve from a pending
invoice; without it the final hop stays pending (explicit non-terminal).

#### Parameters

##### hashlock

`string`

#### Returns

`string` \| `Promise`\<`string` \| `undefined`\> \| `undefined`

***

### signer

> **signer**: `ChannelSigner`

***

### swarm

> **swarm**: `OmniaSwarm`
