[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / TrustIndexConfig

# Interface: TrustIndexConfig

## Properties

### enabled

> **enabled**: `true`

***

### requireVerifiedSignature?

> `optional` **requireVerifiedSignature?**: `boolean`

Require at minimum a well-formed hex signature on TRUST_RECORD messages.
Default: true. Full WOTS cryptographic verification is a future hardening pass
(requires chain RPC lookup of the reviewer's public key).
Set to false only for development/testing.
