[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / RelayOmniaClientOptions

# Interface: RelayOmniaClientOptions

## Extends

- [`RelayOmniaSwarmOptions`](RelayOmniaSwarmOptions.md)

## Extended by

- [`OmniaRelayClientOptions`](OmniaRelayClientOptions.md)

## Properties

### apiKey?

> `optional` **apiKey?**: `string`

Axia API key (hosted mode); appended to the relay URL as `?apiKey=`.

#### Inherited from

[`RelayOmniaSwarmOptions`](RelayOmniaSwarmOptions.md).[`apiKey`](RelayOmniaSwarmOptions.md#apikey)

***

### autoAccept?

> `optional` **autoAccept?**: `boolean`

Wire inbound CHANNEL_PROPOSAL/STATE_UPDATE/SETTLEMENT_PROPOSAL handling. Default true.

***

### chainProvider?

> `optional` **chainProvider?**: `ChainStateProvider`

***

### channels?

> `optional` **channels?**: `Map`\<`string`, [`OmniaChannel`](OmniaChannel.md)\>

Channel registry (defaults to a fresh in-memory Map).

***

### leaseProvider?

> `optional` **leaseProvider?**: `WotsLeaseProvider`

***

### localParticipant?

> `optional` **localParticipant?**: `ChannelParticipant`

Wallet channel participant; with the ports below, auto-builds operations.

***

### localPubkey?

> `optional` **localPubkey?**: `string`

Local participant public-key digest, advertised on the relay.

#### Inherited from

[`RelayOmniaSwarmOptions`](RelayOmniaSwarmOptions.md).[`localPubkey`](RelayOmniaSwarmOptions.md#localpubkey)

***

### operations?

> `optional` **operations?**: [`RelayOmniaOperations`](RelayOmniaOperations.md)

Local channel operations. When absent (and no signing material is supplied),
`openChannel`/`pay`/`settle`/`closeChannel` return an explicit `UNSUPPORTED`
result.

***

### relayUrl?

> `optional` **relayUrl?**: `string`

Self-hosted relay/sidecar URL. Defaults to [AXIA\_RELAY\_URL](../variables/AXIA_RELAY_URL.md).

#### Inherited from

[`RelayOmniaSwarmOptions`](RelayOmniaSwarmOptions.md).[`relayUrl`](RelayOmniaSwarmOptions.md#relayurl)

***

### signer?

> `optional` **signer?**: `ChannelSigner`

***

### swarm?

> `optional` **swarm?**: `OmniaSwarm`

Pre-built swarm (e.g. a host-managed relay connection). Defaults to one built from the relay URL.
