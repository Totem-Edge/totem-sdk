[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / fulfillMultiHop

# Function: fulfillMultiHop()

> **fulfillMultiHop**(`params`): `Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `htlcId`: `string`; `success`: `boolean`; \}\>

Reveal the preimage for an incoming multi-hop HTLC (RFC-035 B4, receiving side):
fulfil the HTLC on `channel` and forward the updated STATE_UPDATE to the peer,
so the preimage propagates back along the route.

## Parameters

### params

#### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

#### htlcId

`string`

#### leaseProvider

`WotsLeaseProvider`

#### preimage

`string`

#### signer

`ChannelSigner`

#### swarm

`OmniaSwarm`

## Returns

`Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `htlcId`: `string`; `success`: `boolean`; \}\>
