[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / SpliceAcceptance

# Interface: SpliceAcceptance

`acceptorReservationId` and `acceptorSigningIndices` carry the WOTS lease
reservation used when producing `acceptorSignature`. Consumed by
`finalizeSplice` to commit or burn the acceptor's key-slot reservation.

## Properties

### acceptedAt

> **acceptedAt**: `number`

***

### acceptorPublicKeyDigest

> **acceptorPublicKeyDigest**: `string`

***

### acceptorReservationId

> **acceptorReservationId**: `string`

***

### acceptorSignature

> **acceptorSignature**: [`WotsSignature`](../type-aliases/WotsSignature.md)

***

### acceptorSigningIndices

> **acceptorSigningIndices**: `SigningIndices`

***

### channelId

> **channelId**: `string`

***

### spliceId

> **spliceId**: `string`
