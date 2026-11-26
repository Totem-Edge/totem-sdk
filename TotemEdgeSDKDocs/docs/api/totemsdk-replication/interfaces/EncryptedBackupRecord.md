[**@totemsdk/replication**](../index.md)

***

[@totemsdk/replication](../index.md) / EncryptedBackupRecord

# Interface: EncryptedBackupRecord

## Properties

### backupId

> `readonly` **backupId**: `string`

***

### ciphertext

> `readonly` **ciphertext**: `Uint8Array`

***

### createdAt

> `readonly` **createdAt**: `number`

***

### digest

> `readonly` **digest**: `string`

SHA3-256 of the ciphertext (integrity, not confidentiality).

***

### version

> `readonly` **version**: `number`
