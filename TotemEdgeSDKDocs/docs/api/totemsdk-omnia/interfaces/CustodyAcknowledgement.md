[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / CustodyAcknowledgement

# Interface: CustodyAcknowledgement

Portable acknowledgement of one exact disclosure (RFC-061 D2).
The host must verify this against its configured disclosure; it must never
trust a caller-supplied boolean.

## Properties

### acknowledgedAt

> **acknowledgedAt**: `number`

***

### disclosureHash

> **disclosureHash**: `string`

***

### disclosureId

> **disclosureId**: `string`

***

### disclosureVersion

> **disclosureVersion**: `string`

***

### expiresAt?

> `optional` **expiresAt?**: `number`

***

### signature?

> `optional` **signature?**: `Uint8Array`\<`ArrayBufferLike`\>

Optional proof; required when the ack crosses a trust boundary.

***

### signerPublicKeyDigest?

> `optional` **signerPublicKeyDigest?**: `string`

***

### subjectId

> **subjectId**: `string`
