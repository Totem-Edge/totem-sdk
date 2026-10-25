[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / TokenCreationParams

# Interface: TokenCreationParams

## Properties

### burn?

> `optional` **burn?**: `string`

Amount of MINIMA to burn with the minting transaction (display units, e.g.
"0.1"). Matches Minima's `tokencreate burn:`.

***

### decimals

> **decimals**: `number`

Decimal places, 0..44. `0` denotes a non-fungible token (NFT); Java
`scale = 44 - decimals`.

***

### metadata

> **metadata**: [`TokenMetadata`](TokenMetadata.md)

Token metadata (name, ticker, description, images, web links, traits, …).

***

### recipientAddress?

> `optional` **recipientAddress?**: `string`

Address to receive the created token supply; defaults to the wallet's primary address.

***

### script?

> `optional` **script?**: `string`

Optional token script (defaults to `RETURN TRUE`).

***

### signtoken?

> `optional` **signtoken?**: `string`

Public key to sign the token creation with (Minima's `signtoken:`), proving
authorship. The signature over the token coin id is added to the token
metadata. NOTE: not yet implemented by the wallet handler.

***

### totalSupply

> **totalSupply**: `string`

Total supply in display units (e.g. "1000000"; "1" for an NFT).
