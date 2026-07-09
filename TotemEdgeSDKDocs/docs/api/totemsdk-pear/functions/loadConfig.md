[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / loadConfig

# Function: loadConfig()

> **loadConfig**(`appName`, `configPath?`): `Promise`\<[`AppConfig`](../interfaces/AppConfig.md)\>

Load app configuration.

Resolution order:
  1. `globalThis.Pear.config` — Pear-runtime-injected config object
  2. `pear://config/<appName>` — looked up in `globalThis.Pear.storage`
     (Pear's local persistent KV store for the app)
  3. `configPath` — JSON file on disk (bare-fs → node:fs fallback)
  4. Default: `{ appName }`

## Parameters

### appName

`string`

### configPath?

`string`

## Returns

`Promise`\<[`AppConfig`](../interfaces/AppConfig.md)\>
