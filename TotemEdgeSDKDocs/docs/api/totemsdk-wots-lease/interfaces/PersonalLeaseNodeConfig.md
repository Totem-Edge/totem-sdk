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

Identity that authenticates certificates issued by this node.
When set, `verifyLeaseCertificate` performs cryptographic signature
verification; without it, verification is issuer-only (no signature check).

***

### nodePubkey

> **nodePubkey**: `string`

***

### nodeUrl

> **nodeUrl**: `string`
