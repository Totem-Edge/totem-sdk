[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / RelayConfig

# Type Alias: RelayConfig

> **RelayConfig** = \{ `mode`: `"native"`; \} \| \{ `apiKey`: `string`; `endpoint?`: `string`; `mode`: `"hosted"`; \} \| \{ `mode`: `"self-hosted"`; `relayUrl`: `string`; \}

Transport mode for the Omnia swarm.

- `'native'`      — Raw Hyperswarm P2P (default). Requires the `hyperswarm` peer
                    dependency. Ideal for Node.js / Pear / Bare environments.
- `'hosted'`      — Axia-managed relay. Pass your API key; no Hyperswarm binary
                    needed. Works in browsers and restricted server environments.
- `'self-hosted'` — Your own relay node. Pass the `relayUrl` of a relay running
                    the Axia DHT Relay Bridge protocol.

## Union Members

### Type Literal

\{ `mode`: `"native"`; \}

***

### Type Literal

\{ `apiKey`: `string`; `endpoint?`: `string`; `mode`: `"hosted"`; \}

#### apiKey

> **apiKey**: `string`

Your Axia API key (starts with `axia_`).

#### endpoint?

> `optional` **endpoint?**: `string`

Override the default Axia relay endpoint.
Defaults to `wss://api.axia.to/api/relay/ws`.

#### mode

> **mode**: `"hosted"`

***

### Type Literal

\{ `mode`: `"self-hosted"`; `relayUrl`: `string`; \}

#### mode

> **mode**: `"self-hosted"`

#### relayUrl

> **relayUrl**: `string`

WebSocket URL of your relay node, e.g. `wss://relay.example.com`.
