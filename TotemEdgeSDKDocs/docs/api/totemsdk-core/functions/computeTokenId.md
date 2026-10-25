[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / computeTokenId

# Function: computeTokenId()

> **computeTokenId**(`token`): `Uint8Array`

Compute a Minima **token id** — SHA3-256 of the MiniData-wrapped serialized
Token, matching Java `Token.calculateTokenID()`. A newly created token's coins
carry this value as their `tokenId`; token creation returns it.

## Parameters

### token

[`MinimaToken`](../interfaces/MinimaToken.md)

## Returns

`Uint8Array`
