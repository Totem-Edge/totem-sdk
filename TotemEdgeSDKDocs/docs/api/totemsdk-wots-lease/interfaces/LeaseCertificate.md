[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / LeaseCertificate

# Interface: LeaseCertificate

## Properties

### attestations?

> `optional` **attestations?**: [`QuorumAttestation`](QuorumAttestation.md)[]

Layer 4 — quorum attestations collected from P2P peers.

***

### branchId?

> `optional` **branchId?**: `string`

***

### deviceId?

> `optional` **deviceId?**: `string`

***

### expiresAt

> **expiresAt**: `number`

***

### indices

> **indices**: [`SigningIndices`](SigningIndices.md)

***

### issuedAt

> **issuedAt**: `number`

***

### issuedBy

> **issuedBy**: `string`

***

### payloadHash?

> `optional` **payloadHash?**: `string`

***

### purpose?

> `optional` **purpose?**: `string`

***

### reservationId

> **reservationId**: `string`

***

### signature

> **signature**: `string`

***

### treeId

> **treeId**: `string`

***

### txpowid?

> `optional` **txpowid?**: `string`

Layer 5 — content hash of the on-chain watermark TX (sha3-256 of TxPoW bytes).
