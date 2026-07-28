[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createIdentityPortAdapter

# Function: createIdentityPortAdapter()

> **createIdentityPortAdapter**(`config`): `EdgeIdentityPort`

Wraps an IdentityGraph (from @totemsdk/identity) as an EdgeIdentityPort.

resolve: returns the resolved identity when identityId matches graph.document.id,
         otherwise returns ok:false. For multi-identity setups, compose multiple
         adapters or use a router above this layer.
verify:  delegates to verifyIdentityClaim() for SignedIdentityClaim values.
         Returns ok:false for unrecognised proof shapes.

## Parameters

### config

[`IdentityPortConfig`](../interfaces/IdentityPortConfig.md)

## Returns

`EdgeIdentityPort`
