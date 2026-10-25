[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / setWotsLogger

# Function: setWotsLogger()

> **setWotsLogger**(`logger`): `void`

Enable WOTS debug logging with a custom logger
Use this for parity testing to capture all intermediate values

WARNING: Debug logging outputs sensitive cryptographic material including
private key chains and seeds. NEVER enable in production builds.
This is intended for development/testing parity verification only.

## Parameters

### logger

[`LoggerAdapter`](../interfaces/LoggerAdapter.md)

## Returns

`void`
