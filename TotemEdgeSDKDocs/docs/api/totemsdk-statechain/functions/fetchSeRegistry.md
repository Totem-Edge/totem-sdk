[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / fetchSeRegistry

# Function: fetchSeRegistry()

> **fetchSeRegistry**(`registryUrl?`, `fetchImpl?`): `Promise`\<[`SERegistryEntry`](../interfaces/SERegistryEntry.md)[]\>

Fetch and cache the SE registry from a given URL.

## Parameters

### registryUrl?

`string` = `DEFAULT_REGISTRY_URL`

### fetchImpl?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

## Returns

`Promise`\<[`SERegistryEntry`](../interfaces/SERegistryEntry.md)[]\>
