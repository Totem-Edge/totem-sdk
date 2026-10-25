[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / WotsAuthEnvelope

# Interface: WotsAuthEnvelope

RFC-032: post-quantum authentication envelope.

Flat WOTS/TreeKey signature over `sha3_256(canonicalJson({type,id?,payload} ‖ nonce ‖ expiresAt))`.
- `rootPublicKey`: hex of the signer's 32-byte WOTS PKdigest (what `wotsVerifyDigest` needs).
- `signature`: hex WOTS signature.
- `nonce`: monotonic per-identity anti-replay value.
- `expiresAt`: absolute expiry (epoch ms); the node rejects stale messages.
- `rootIdentityProof` (optional): opaque proof binding the signer to a root
  identity, verified by a registered `proofVerifiers['root-identity']`.
- `address` (optional): Minima address; only trusted when the proof verifies.

## Properties

### address?

> `optional` **address?**: `string`

***

### expiresAt

> **expiresAt**: `number`

***

### nonce

> **nonce**: `number`

***

### rootIdentityProof?

> `optional` **rootIdentityProof?**: `string`

***

### rootPublicKey

> **rootPublicKey**: `string`

***

### signature

> **signature**: `string`
