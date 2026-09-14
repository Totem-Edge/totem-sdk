[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / IdentityChallengeProof

# Interface: IdentityChallengeProof

A signature-backed identity proof (#10/#32): the claimed address proves
control by signing a domain-separated challenge with its WOTS key. The
advisory `identityGraph` is no longer the load-bearing check — a signature
from the address-derived public key is.

## Properties

### address

> **address**: `string`

***

### challenge

> **challenge**: `string`

Hex of the challenge bytes that were signed.

***

### publicKeyDigest

> **publicKeyDigest**: `string`

Hex of the 32-byte WOTS public key digest.

***

### signature

> **signature**: `string`

Hex WOTS signature over the challenge.
