[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / PersonalLeaseNodeConfig

# Interface: PersonalLeaseNodeConfig

## Properties

### authToken?

> `optional` **authToken?**: `string`

***

### certificateSigner?

> `optional` **certificateSigner?**: [`CertificateSigner`](CertificateSigner.md)

Identity that authenticates certificates issued by this node. When it
carries a `verify()` function, `verifyLeaseCertificate` uses it. Without
any verifier the provider FAILS CLOSED (AUD-016) — an identity match on
`issuedBy` alone is never enough.

***

### nodePubkey

> **nodePubkey**: `string`

***

### nodeUrl

> **nodeUrl**: `string`

***

### verify?

> `optional` **verify?**: (`message`, `signature`) => `Promise`\<`boolean`\>

Verify-only cryptographic verifier for certificates issued by the node.
The provider holds no signing key, so this is the recommended way to make
`verifyLeaseCertificate` functional. When neither this nor a
`certificateSigner.verify` is supplied, the provider rejects every
certificate (fail closed).

#### Parameters

##### message

`Uint8Array`

##### signature

`Uint8Array`

#### Returns

`Promise`\<`boolean`\>
