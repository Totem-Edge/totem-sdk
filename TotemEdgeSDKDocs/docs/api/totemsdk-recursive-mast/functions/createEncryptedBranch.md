[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / createEncryptedBranch

# Function: createEncryptedBranch()

> **createEncryptedBranch**(`branch`, `encryptFn`, `keyFingerprint`, `recipientPkds`): `Promise`\<[`EncryptedBranchPackage`](../interfaces/EncryptedBranchPackage.md)\>

## Parameters

### branch

[`MastBranchPackage`](../interfaces/MastBranchPackage.md)

### encryptFn

(`data`) => `Uint8Array`\<`ArrayBufferLike`\> \| `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

### keyFingerprint

`string`

### recipientPkds

`string`[]

## Returns

`Promise`\<[`EncryptedBranchPackage`](../interfaces/EncryptedBranchPackage.md)\>
