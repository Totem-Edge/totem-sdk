[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / OmniaL2PaymentPortConfig

# Interface: OmniaL2PaymentPortConfig

## Properties

### channels

> **channels**: `Map`\<`string`, `RouterChannel`\>

Live channel state keyed by channelId.
executeMultiHopPayment mutates this map in-place as HTLCs are added/settled.
Callers are responsible for keeping it in sync with the on-chain state.

***

### graph

> **graph**: `ChannelGraph`

Routing graph (edges + swap index). Updated externally as channels open/close.

***

### htlcTimeoutBlocks?

> `optional` **htlcTimeoutBlocks?**: `bigint`

HTLC timeout in blocks past the current tip. Defaults to 144 (≈24h on Minima).

***

### leaseProviders

> **leaseProviders**: `Map`\<`string`, `LeaseProvider`\>

WOTS lease providers keyed by channelId — required for HTLC signing.

***

### localPublicKeyDigest

> **localPublicKeyDigest**: `string`

Public key digest identifying the local party in each channel.

***

### ops

> **ops**: `ChannelOps`

HTLC operations (addHTLC, fulfillHTLC, timeoutHTLC) for each channel.

***

### routeOptions?

> `optional` **routeOptions?**: `any`

Optional pathfinding overrides forwarded to findRoute.

## Methods

### getCurrentBlock()

> **getCurrentBlock**(): `Promise`\<`bigint`\>

Returns the current chain block height. Used to compute HTLC expiry.
Typically: `async () => BigInt((await provider.getTip()).block)`.

#### Returns

`Promise`\<`bigint`\>
