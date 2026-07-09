[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / SwarmConfig

# Interface: SwarmConfig

@totemsdk/pear — Config loading utilities

`loadConfig` reads app configuration in the following order:
  1. `globalThis.Pear.config` — structured data injected by the Pear runtime
     when the app is launched from a Pear link (pear://<key>/<name>). This is
     the authoritative Pear config source; no additional network call is made.
  2. `pear://config/<appName>` — conventional key name checked inside
     `globalThis.Pear.storage` (Pear's local app KV store) when the Pear
     runtime is present but `Pear.config` does not carry the app config.
  3. `configPath` (file on disk, JSON) — explicit override for non-Pear
     environments (Node.js scripts, local dev server, Bare without Pear).
  4. Empty default config `{ appName }`.

`defaultSwarmConfig()` returns safe defaults for Hyperswarm join options.

Bare-compatible: no `process.env`, no `__dirname`, no `require`.

## Properties

### client

> **client**: `boolean`

***

### maxPeers

> **maxPeers**: `number`

***

### server

> **server**: `boolean`

***

### timeoutMs

> **timeoutMs**: `number`
