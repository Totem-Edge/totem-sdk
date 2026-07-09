[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / createOmniaSwarmFromRelayUrl

# Function: createOmniaSwarmFromRelayUrl()

> **createOmniaSwarmFromRelayUrl**(`relayUrl`, `config?`): [`OmniaSwarm`](../interfaces/OmniaSwarm.md)

Create an OmniaSwarm connected to a relay at the given WebSocket URL.
Works in browsers and any environment where WebSocket is available.

## Parameters

### relayUrl

`string`

### config?

[`OmniaSwarmConfig`](../interfaces/OmniaSwarmConfig.md) = `{}`

## Returns

[`OmniaSwarm`](../interfaces/OmniaSwarm.md)

## Example

```ts
// Self-hosted relay
const swarm = createOmniaSwarmFromRelayUrl('wss://relay.example.com', { localPubkey });

// Axia hosted relay (shorthand — prefer createOmniaSwarm with relay config)
const swarm = createOmniaSwarmFromRelayUrl(
  'wss://api.axia.to/api/relay/ws?apiKey=axia_...',
);
```
