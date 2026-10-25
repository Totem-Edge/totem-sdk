[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / OmniaRelayClientOptions

# Interface: OmniaRelayClientOptions

## Extends

- [`RelayOmniaClientOptions`](RelayOmniaClientOptions.md)

## Properties

### apiKey?

> `optional` **apiKey?**: `string`

Axia API key (hosted mode); appended to the relay URL as `?apiKey=`.

#### Inherited from

[`RelayOmniaClientOptions`](RelayOmniaClientOptions.md).[`apiKey`](RelayOmniaClientOptions.md#apikey)

***

### autoAccept?

> `optional` **autoAccept?**: `boolean`

Wire inbound CHANNEL_PROPOSAL/STATE_UPDATE/SETTLEMENT_PROPOSAL handling. Default true.

#### Inherited from

[`RelayOmniaClientOptions`](RelayOmniaClientOptions.md).[`autoAccept`](RelayOmniaClientOptions.md#autoaccept)

***

### chainProvider?

> `optional` **chainProvider?**: `ChainStateProvider`

#### Inherited from

[`RelayOmniaClientOptions`](RelayOmniaClientOptions.md).[`chainProvider`](RelayOmniaClientOptions.md#chainprovider)

***

### channels?

> `optional` **channels?**: `Map`\<`string`, [`OmniaChannel`](OmniaChannel.md)\>

Channel registry (defaults to a fresh in-memory Map).

#### Inherited from

[`RelayOmniaClientOptions`](RelayOmniaClientOptions.md).[`channels`](RelayOmniaClientOptions.md#channels)

***

### leaseProvider?

> `optional` **leaseProvider?**: `WotsLeaseProvider`

#### Inherited from

[`RelayOmniaClientOptions`](RelayOmniaClientOptions.md).[`leaseProvider`](RelayOmniaClientOptions.md#leaseprovider)

***

### localParticipant?

> `optional` **localParticipant?**: `ChannelParticipant`

Wallet channel participant; with the ports below, auto-builds operations.

#### Inherited from

[`RelayOmniaClientOptions`](RelayOmniaClientOptions.md).[`localParticipant`](RelayOmniaClientOptions.md#localparticipant)

***

### localPubkey?

> `optional` **localPubkey?**: `string`

Local participant public-key digest, advertised on the relay.

#### Inherited from

[`RelayOmniaClientOptions`](RelayOmniaClientOptions.md).[`localPubkey`](RelayOmniaClientOptions.md#localpubkey)

***

### operations?

> `optional` **operations?**: [`RelayOmniaOperations`](RelayOmniaOperations.md)

Local channel operations. When absent (and no signing material is supplied),
`openChannel`/`pay`/`settle`/`closeChannel` return an explicit `UNSUPPORTED`
result.

#### Inherited from

[`RelayOmniaClientOptions`](RelayOmniaClientOptions.md).[`operations`](RelayOmniaClientOptions.md#operations)

***

### relayUrl?

> `optional` **relayUrl?**: `string`

Self-hosted relay/sidecar URL. Defaults to [AXIA\_RELAY\_URL](../variables/AXIA_RELAY_URL.md).

#### Inherited from

[`RelayOmniaClientOptions`](RelayOmniaClientOptions.md).[`relayUrl`](RelayOmniaClientOptions.md#relayurl)

***

### routing?

> `optional` **routing?**: [`RoutingPort`](RoutingPort.md)

Injected routing topology (defaults to the wallet's own channels).

***

### signer?

> `optional` **signer?**: `ChannelSigner`

#### Inherited from

[`RelayOmniaClientOptions`](RelayOmniaClientOptions.md).[`signer`](RelayOmniaClientOptions.md#signer)

***

### swarm?

> `optional` **swarm?**: `OmniaSwarm`

Pre-built swarm (e.g. a host-managed relay connection). Defaults to one built from the relay URL.

#### Inherited from

[`RelayOmniaClientOptions`](RelayOmniaClientOptions.md).[`swarm`](RelayOmniaClientOptions.md#swarm)
