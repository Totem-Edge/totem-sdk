[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createLocationPortAdapter

# Function: createLocationPortAdapter()

> **createLocationPortAdapter**(`config?`): `EdgeLocationPort`

Wraps @totemsdk/location-proof as an EdgeLocationPort.

createClaim/createTrail build content-derived Totem-location claims/trails.
createProof returns a SignedProof when config.seed is set; otherwise it
returns an UnsignedProof that MUST NOT be presented as a completed proof.

## Parameters

### config?

[`LocationPortConfig`](../interfaces/LocationPortConfig.md) = `{}`

## Returns

`EdgeLocationPort`
