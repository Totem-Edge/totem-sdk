[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / HostSigning

# Interface: HostSigning

## Properties

### address

> **address**: `string`

Minima address for the unified child TreeKey (identity + channels).

***

### addressIndex

> **addressIndex**: `number`

***

### baseSeed

> **baseSeed**: `Uint8Array`

32-byte base seed (used by the identity/manifest layer).

***

### deviceId

> **deviceId**: `string`

***

### leaseProvider

> **leaseProvider**: `WotsLeaseProvider`

***

### publicKeyDigest

> **publicKeyDigest**: `string`

Channel participant key: the unified child TreeKey root pubkey (RFC-037).

***

### signer

> **signer**: `ChannelSigner`

***

### transportKeyPair

> **transportKeyPair**: `object`

Stable ed25519 keypair used as the native Hyperswarm transport identity.
Derived deterministically from the host seed. The transport is classical
(noise); its public key is bound to the PQ identity by the signed manifest.

#### publicKey

> **publicKey**: `Uint8Array`

#### secretKey

> **secretKey**: `Uint8Array`

***

### transportPubkey

> **transportPubkey**: `string`

`0x`-prefixed hex transport public key (published in the signed manifest).

***

### treeKey

> **treeKey**: `TreeKey`

Unified child TreeKey used for channel + manifest signing (RFC-037).
