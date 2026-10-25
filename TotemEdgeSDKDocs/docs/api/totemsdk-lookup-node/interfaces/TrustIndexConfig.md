[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / TrustIndexConfig

# Interface: TrustIndexConfig

## Properties

### enabled

> **enabled**: `true`

***

### requireVerifiedSignature?

> `optional` **requireVerifiedSignature?**: `boolean`

Require reviewer signatures to be cryptographically verified before a
TRUST_RECORD is persisted. Default: true (fail closed). When true, a record
is only accepted if `verifyReviewerSignature` is configured AND returns
true. Set to false only for development/testing.

***

### verifyReviewerSignature?

> `optional` **verifyReviewerSignature?**: (`record`, `authenticatedPublicKey?`) => `boolean` \| `Promise`\<`boolean`\>

Cryptographic verifier for a TRUST_RECORD payload. Required when
`requireVerifiedSignature` is true; when omitted, every TRUST_RECORD is
rejected (fail closed). The `record` argument is the signed review payload
and `authenticatedPublicKey` is the public key bound to the authenticated
session (when available), so the verifier can check the reviewer's WOTS
signature against the key recovered from the chain.

#### Parameters

##### record

###### comment?

`string`

###### rating

`number`

###### reviewerAddress

`string`

###### reviewerPublicKey?

`string`

Hex WOTS PKdigest of the reviewer, when supplied (else derived via session).

###### signature

`string`

Hex WOTS signature over the canonical review payload (RFC-032).

###### subjectId

`string`

##### authenticatedPublicKey?

`string`

#### Returns

`boolean` \| `Promise`\<`boolean`\>
