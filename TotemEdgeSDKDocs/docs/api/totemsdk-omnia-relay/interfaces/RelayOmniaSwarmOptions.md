[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / RelayOmniaSwarmOptions

# Interface: RelayOmniaSwarmOptions

## Extended by

- [`RelayOmniaClientOptions`](RelayOmniaClientOptions.md)

## Properties

### apiKey?

> `optional` **apiKey?**: `string`

Axia API key (hosted mode); appended to the relay URL as `?apiKey=`.

***

### localPubkey?

> `optional` **localPubkey?**: `string`

Local participant public-key digest, advertised on the relay.

***

### relayUrl?

> `optional` **relayUrl?**: `string`

Self-hosted relay/sidecar URL. Defaults to [AXIA\_RELAY\_URL](../variables/AXIA_RELAY_URL.md).
