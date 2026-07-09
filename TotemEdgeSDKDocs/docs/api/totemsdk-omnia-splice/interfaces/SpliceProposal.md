[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / SpliceProposal

# Interface: SpliceProposal

Splice proposal produced by the initiating party.

`spliceTxHex` contains the canonical Minima TX bytes (hex) that both parties
independently verify before signing. `spliceTxDraft` retains the structured
representation needed for digest computation and output inspection by the
acceptor; it is NOT sent over the wire in production but is included here for
the v0.1.0 in-process protocol. Future relay integration will transmit only
`spliceTxHex` + `params`.

`proposerReservationId` and `proposerSigningIndices` carry the WOTS lease
reservation used when producing `proposerSignature`. They are consumed by
`finalizeSplice` to commit or burn the reservation after the splice TX is
settled, preserving key-slot accounting and preventing one-time-key reuse.

## Properties

### channelId

> **channelId**: `string`

***

### params

> **params**: [`SpliceParams`](SpliceParams.md)

***

### proposedAt

> **proposedAt**: `number`

***

### proposerPublicKeyDigest

> **proposerPublicKeyDigest**: `string`

***

### proposerReservationId

> **proposerReservationId**: `string`

***

### proposerSignature

> **proposerSignature**: [`WotsSignature`](../type-aliases/WotsSignature.md)

***

### proposerSigningIndices

> **proposerSigningIndices**: `SigningIndices`

***

### spliceId

> **spliceId**: `string`

***

### spliceTxDraft

> **spliceTxDraft**: [`SpliceTxDraft`](SpliceTxDraft.md)

***

### spliceTxHex

> **spliceTxHex**: `string`
