[**@totemsdk/claim**](../index.md)

***

[@totemsdk/claim](../index.md) / VerifyClaimOptions

# Interface: VerifyClaimOptions

## Properties

### chainTip?

> `optional` **chainTip?**: `number`

Authoritative chain tip. When provided, a claim context block above the
tip is rejected, so the caller cannot pick a favourable future block.

***

### verifySignature

> **verifySignature**: [`ClaimSignatureVerifier`](../type-aliases/ClaimSignatureVerifier.md)

Cryptographic verifier. Required — there is no default trust anchor.
