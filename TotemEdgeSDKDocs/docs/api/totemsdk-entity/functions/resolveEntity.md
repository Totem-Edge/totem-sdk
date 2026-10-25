[**@totemsdk/entity**](../index.md)

***

[@totemsdk/entity](../index.md) / resolveEntity

# Function: resolveEntity()

> **resolveEntity**(`sources`, `options?`): `Promise`\<[`EntityResolution`](../interfaces/EntityResolution.md)\>

Resolve an entity from local sources at an explicit time.

Never fetches the network, signs, or grants authority. The optional
`proofVerifier` should be a root-identity verifier; root ancestry is evidence
only and never widens authorization.

## Parameters

### sources

[`EntitySources`](../interfaces/EntitySources.md)

### options?

[`EntityResolverOptions`](../interfaces/EntityResolverOptions.md) = `{}`

## Returns

`Promise`\<[`EntityResolution`](../interfaces/EntityResolution.md)\>
