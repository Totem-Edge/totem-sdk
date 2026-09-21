[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / HostSigning

# Interface: HostSigning

## Properties

### address

> **address**: `string`

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

### perAddressSeed

> **perAddressSeed**: `Uint8Array`

Per-address seed used for channel signing (key index 0).

***

### publicKeyDigest

> **publicKeyDigest**: `string`

***

### signer

> **signer**: `ChannelSigner`
