[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / SignerAuditEntry

# Interface: SignerAuditEntry

Durable audit record for every policy-signer decision (RFC-061 D6).

## Extends

- [`SignerAuditRecord`](SignerAuditRecord.md)

## Properties

### acknowledgementId?

> `optional` **acknowledgementId?**: `string`

#### Inherited from

[`SignerAuditRecord`](SignerAuditRecord.md).[`acknowledgementId`](SignerAuditRecord.md#acknowledgementid)

***

### amount?

> `optional` **amount?**: `string`

#### Inherited from

[`SignerAuditRecord`](SignerAuditRecord.md).[`amount`](SignerAuditRecord.md#amount)

***

### auditId

> **auditId**: `string`

***

### decision

> **decision**: `"allow"` \| `"deny"`

#### Inherited from

[`SignerAuditRecord`](SignerAuditRecord.md).[`decision`](SignerAuditRecord.md#decision)

***

### disclosureId

> **disclosureId**: `string`

#### Inherited from

[`SignerAuditRecord`](SignerAuditRecord.md).[`disclosureId`](SignerAuditRecord.md#disclosureid)

***

### domain

> **domain**: `SignDomain`

#### Inherited from

[`SignerAuditRecord`](SignerAuditRecord.md).[`domain`](SignerAuditRecord.md#domain)

***

### mfaVerified?

> `optional` **mfaVerified?**: `boolean`

#### Inherited from

[`SignerAuditRecord`](SignerAuditRecord.md).[`mfaVerified`](SignerAuditRecord.md#mfaverified)

***

### mode

> **mode**: `CustodyMode`

#### Inherited from

[`SignerAuditRecord`](SignerAuditRecord.md).[`mode`](SignerAuditRecord.md#mode)

***

### occurredAt?

> `optional` **occurredAt?**: `number`

#### Inherited from

[`SignerAuditRecord`](SignerAuditRecord.md).[`occurredAt`](SignerAuditRecord.md#occurredat)

***

### reason?

> `optional` **reason?**: `string`

#### Inherited from

[`SignerAuditRecord`](SignerAuditRecord.md).[`reason`](SignerAuditRecord.md#reason)

***

### recordedAt

> **recordedAt**: `number`

***

### requestId

> **requestId**: `string`

#### Inherited from

[`SignerAuditRecord`](SignerAuditRecord.md).[`requestId`](SignerAuditRecord.md#requestid)

***

### signer

> **signer**: `string`

#### Inherited from

[`SignerAuditRecord`](SignerAuditRecord.md).[`signer`](SignerAuditRecord.md#signer)

***

### summary?

> `optional` **summary?**: `string`

#### Inherited from

[`SignerAuditRecord`](SignerAuditRecord.md).[`summary`](SignerAuditRecord.md#summary)
