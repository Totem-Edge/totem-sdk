[**@totemsdk/manifest**](../index.md)

***

[@totemsdk/manifest](../index.md) / discoverInstalledTotemPackages

# Function: discoverInstalledTotemPackages()

> **discoverInstalledTotemPackages**(`options?`): `Promise`\<`Record`\<`string`, `string`\>\>

Best-effort discovery of installed `@totemsdk/*` package versions by walking
upward for node_modules. Read-only and runtime-agnostic so any SDK entrypoint
can use the same awareness check. Unreadable manifests are skipped.

## Parameters

### options?

[`DiscoverInstalledOptions`](../interfaces/DiscoverInstalledOptions.md) = `{}`

## Returns

`Promise`\<`Record`\<`string`, `string`\>\>
