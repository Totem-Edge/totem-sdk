[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / ReplicatedCipher

# Interface: ReplicatedCipher

RFC-057 Phase 5 — encrypted dataset envelopes and replication quotas.

Encryption is explicit per dataset and never inferred from a key path. The
envelope carries its own version and IV; quotas are enforced before a write
reaches the log or view.

## Methods

### decrypt()

> **decrypt**(`ciphertext`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Parameters

##### ciphertext

`Uint8Array`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### encrypt()

> **encrypt**(`plaintext`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Parameters

##### plaintext

`Uint8Array`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>
