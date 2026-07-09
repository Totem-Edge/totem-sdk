[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / createOmniaSwarm

# Function: createOmniaSwarm()

> **createOmniaSwarm**(`config?`): `Promise`\<[`OmniaSwarm`](../interfaces/OmniaSwarm.md)\>

Create an OmniaSwarm.

The transport is determined by `config.relay` (defaults to `{ mode: 'native' }`):

- **`'native'`** (default) — Raw Hyperswarm P2P. Requires the `hyperswarm` peer
  dependency. Ideal for Node.js / Pear / Bare environments.

- **`'hosted'`** — Axia-managed relay. No `hyperswarm` binary needed; works in
  browsers and restricted environments.
  ```ts
  const swarm = await createOmniaSwarm({
    relay: { mode: 'hosted', apiKey: 'axia_...' },
  });
  ```

- **`'self-hosted'`** — Your own relay node running the Axia DHT Relay Bridge.
  ```ts
  const swarm = await createOmniaSwarm({
    relay: { mode: 'self-hosted', relayUrl: 'wss://relay.example.com' },
  });
  ```

## Parameters

### config?

[`OmniaSwarmConfig`](../interfaces/OmniaSwarmConfig.md) = `{}`

## Returns

`Promise`\<[`OmniaSwarm`](../interfaces/OmniaSwarm.md)\>

## Throws

Error when `mode` is `'native'` and `hyperswarm` is not installed.
