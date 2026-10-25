[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / SignerAuditRecord

# Interface: SignerAuditRecord

Durable audit record for every policy-signer decision (RFC-061 D6).

## Extended by

- [`SignerAuditEntry`](SignerAuditEntry.md)

## Properties

### acknowledgementId?

> `optional` **acknowledgementId?**: `string`

***

### amount?

> `optional` **amount?**: `string`

***

### decision

> **decision**: `"allow"` \| `"deny"`

***

### disclosureId

> **disclosureId**: `string`

***

### domain

> **domain**: `SignDomain`

***

### mfaVerified?

> `optional` **mfaVerified?**: `boolean`

***

### mode

> **mode**: `CustodyMode`

***

### occurredAt?

> `optional` **occurredAt?**: `number`

***

### reason?

> `optional` **reason?**: `string`

***

### requestId

> **requestId**: `string`

***

### signer

> **signer**: `string`

***

### summary?

> `optional` **summary?**: `string`
