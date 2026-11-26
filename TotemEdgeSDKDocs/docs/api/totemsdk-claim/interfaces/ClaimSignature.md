[**@totemsdk/claim**](../index.md)

***

[@totemsdk/claim](../index.md) / ClaimSignature

# Interface: ClaimSignature

One claimed signer signature. Hex strings (with or without `0x`).

## Properties

### publicKey?

> `optional` **publicKey?**: `string`

Optional verification key material (e.g. a WOTS public key).

***

### signature

> **signature**: `string`

Signature over the canonical claim preimage.

***

### signer

> **signer**: `string`

The identity the signature is attributed to (owner, delegate, guardian, …).
