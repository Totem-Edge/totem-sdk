[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / verifyOperatorAutobond

# Function: verifyOperatorAutobond()

> **verifyOperatorAutobond**(`bond`, `manifest`): `boolean`

Verify an operator autobond: payload binding, address ownership, and the WOTS
signature over the payload. "Verified" means cryptographic checking — never a
declared string on the manifest.

## Parameters

### bond

[`OperatorAutobond`](../interfaces/OperatorAutobond.md)

### manifest

[`LiquidityPoolManifest`](../interfaces/LiquidityPoolManifest.md)

## Returns

`boolean`
