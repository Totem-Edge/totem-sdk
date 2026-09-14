[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / P2PQuorumLeaseProviderConfig

# Interface: P2PQuorumLeaseProviderConfig

## Properties

### certificateSigner?

> `optional` **certificateSigner?**: [`CertificateSigner`](CertificateSigner.md)

Identity that authenticates issued certificates. When set, reserved
certificates carry a real signature; without it, certificates are
issued unsigned and will FAIL verification.

***

### local

> **local**: [`LocalLeaseProvider`](../classes/LocalLeaseProvider.md)

Local provider used for the authoritative local watermark + journal.

***

### minAttestations?

> `optional` **minAttestations?**: `number`

Minimum attestations required for a reservation to be considered quorum-approved. Default: 1.

***

### peers

> **peers**: [`QuorumPeer`](QuorumPeer.md)[]

Quorum members to coordinate with (excluding self).

***

### requestTimeoutMs?

> `optional` **requestTimeoutMs?**: `number`

Timeout per peer request. Default: 5_000.

***

### requireQuorumOnCommit?

> `optional` **requireQuorumOnCommit?**: `boolean`

Require quorum approval on commit as well as reserve. Default: false.
