[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / QuorumAttestation

# Interface: QuorumAttestation

## Properties

### expiresAt

> **expiresAt**: `number`

***

### indices

> **indices**: [`SigningIndices`](SigningIndices.md)

***

### peerId

> **peerId**: `string`

***

### peerReservationId?

> `optional` **peerReservationId?**: `string`

The reservation id the peer issued for these indices in its own journal.
Commit/burn broadcasts must reference the peer's id, not the local one
(AUD-044) — each peer only knows the reservation it issued.

***

### signature?

> `optional` **signature?**: `string`
