[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / computeOperatorAutobondPayloadHash

# Function: computeOperatorAutobondPayloadHash()

> **computeOperatorAutobondPayloadHash**(`manifest`): `string`

The payload the pool operator signs: a canonical, domain-separated commitment
to the load-bearing pool parameters. Signing binds the operator to these
parameters — an operator cannot later silently change the capacity, fees, or
lock terms of a pool they autobonded.

## Parameters

### manifest

[`LiquidityPoolManifest`](../interfaces/LiquidityPoolManifest.md)

## Returns

`string`
