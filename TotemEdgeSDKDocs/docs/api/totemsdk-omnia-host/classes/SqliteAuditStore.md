[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / SqliteAuditStore

# Class: SqliteAuditStore

Storage-backed, append-only signer audit log.

## Constructors

### Constructor

> **new SqliteAuditStore**(`path?`): `SqliteAuditStore`

#### Parameters

##### path?

`string` = `':memory:'`

#### Returns

`SqliteAuditStore`

## Methods

### append()

> **append**(`record`): [`SignerAuditEntry`](../interfaces/SignerAuditEntry.md)

#### Parameters

##### record

[`SignerAuditRecord`](../interfaces/SignerAuditRecord.md)

#### Returns

[`SignerAuditEntry`](../interfaces/SignerAuditEntry.md)

***

### close()

> **close**(): `void`

#### Returns

`void`

***

### list()

> **list**(`limit?`): [`SignerAuditEntry`](../interfaces/SignerAuditEntry.md)[]

Newest first.

#### Parameters

##### limit?

`number` = `100`

#### Returns

[`SignerAuditEntry`](../interfaces/SignerAuditEntry.md)[]
