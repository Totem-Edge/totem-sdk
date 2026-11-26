[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / FactoryAuthorizationRequest

# Interface: FactoryAuthorizationRequest

## Properties

### digest

> **digest**: `string`

Digest about to be signed, 0x-prefixed hex.

***

### factoryId

> **factoryId**: `string`

***

### kind

> **kind**: [`FactoryApprovalKind`](../type-aliases/FactoryApprovalKind.md)

***

### participants

> **participants**: `number`

Number of participants in the factory.

***

### peerPublicKeyDigest

> **peerPublicKeyDigest**: `string`

***

### summary

> **summary**: `string`

Human-readable operation summary for an approval UI or audit log.

***

### tokenId

> **tokenId**: `string`

***

### tokenScale

> **tokenScale**: `number`

***

### totalValue

> **totalValue**: `string`

Total value in base units (string to avoid precision loss).
