[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / RestrictedBranchPackage

# Interface: RestrictedBranchPackage

## Properties

### branchHash

> **branchHash**: `string`

The branch's script hash.

***

### counterpartyInstructions

> **counterpartyInstructions**: `string`

Instructions for the counterparty.

***

### encryptedContent?

> `optional` **encryptedContent?**: `Uint8Array`\<`ArrayBufferLike`\>

Encrypted content (optional, for sensitive branches).

***

### encryptionKeyFingerprint?

> `optional` **encryptionKeyFingerprint?**: `string`

Encryption key fingerprint (if encrypted).

***

### mmrProof

> **mmrProof**: `string`

MMR proof that this branch is in the policy root.

***

### parameterSchema

> **parameterSchema**: `Record`\<`string`, `string`\>

Parameter schema for the branch.

***

### policyId

> **policyId**: `string`

The policy ID this branch package belongs to.

***

### recipientPkds

> **recipientPkds**: `string`[]

Recipient public key digests.

***

### script

> **script**: `string`

The KISS VM branch script.
