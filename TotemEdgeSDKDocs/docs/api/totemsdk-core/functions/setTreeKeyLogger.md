[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / setTreeKeyLogger

# Function: setTreeKeyLogger()

> **setTreeKeyLogger**(`logger`): `void`

Enable TreeKey debug logging with a custom logger
Use this for parity testing to capture wallet init intermediate values

WARNING: Debug logging outputs sensitive cryptographic material including
seeds and private key derivation. NEVER enable in production builds.
This is intended for development/testing parity verification only.

## Parameters

### logger

[`LoggerAdapter`](../interfaces/LoggerAdapter.md)

## Returns

`void`
