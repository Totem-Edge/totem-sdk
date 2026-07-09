[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / deriveUnifiedAddressPublicKey

# Function: deriveUnifiedAddressPublicKey()

> **deriveUnifiedAddressPublicKey**(`baseSeed`, `index`): `Bytes`

Fast path for deriving a child address public key without constructing
the full TreeKey. Useful during wallet initialisation.

## Parameters

### baseSeed

`Bytes`

32-byte wallet base seed

### index

`number`

Address index (0-63)

## Returns

`Bytes`

32-byte address public key (MMR root of child TreeKey)
