[**@totemsdk/wallet-adapter**](../index.md)

***

[@totemsdk/wallet-adapter](../index.md) / AccountEntry

# Interface: AccountEntry

## Properties

### address

> **address**: `string`

***

### addressIndex

> **addressIndex**: `number`

***

### balance?

> `optional` **balance?**: `string`

***

### publicKey

> **publicKey**: `string` \| `null`

WOTS public key hex. Required for TOTEM_VERIFY — return null only for accounts that will not be used for verification.
