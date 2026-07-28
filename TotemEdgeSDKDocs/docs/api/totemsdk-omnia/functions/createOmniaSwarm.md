[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / createOmniaSwarm

# Function: createOmniaSwarm()

> **createOmniaSwarm**(`config?`): `Promise`\<[`OmniaSwarm`](../interfaces/OmniaSwarm.md)\>

Create an OmniaSwarm. Transport is determined by `config.relay`:
  - `{ mode: 'native' }` (default) — Raw Hyperswarm P2P.
  - `{ mode: 'hosted', apiKey }` — Axia-managed relay.
  - `{ mode: 'self-hosted', relayUrl }` — Your own relay node.

## Parameters

### config?

[`OmniaSwarmConfig`](../interfaces/OmniaSwarmConfig.md) = `{}`

## Returns

`Promise`\<[`OmniaSwarm`](../interfaces/OmniaSwarm.md)\>
