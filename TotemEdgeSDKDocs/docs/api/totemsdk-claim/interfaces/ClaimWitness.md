[**@totemsdk/claim**](../index.md)

***

[@totemsdk/claim](../index.md) / ClaimWitness

# Interface: ClaimWitness

## Properties

### claimAmount?

> `optional` **claimAmount?**: `bigint`

Vesting claim amount.

***

### path?

> `optional` **path?**: `"claim"` \| `"refund"`

'claim' (before timeout) or 'refund' (after timeout).

***

### preimage?

> `optional` **preimage?**: `string`

***

### scope?

> `optional` **scope?**: `"claim"` \| `"transfer"`

Delegated policy scope being exercised.

***

### signatures?

> `optional` **signatures?**: [`ClaimSignature`](ClaimSignature.md)[]

Cryptographic signatures over a canonical claim preimage. Required by the
authoritative verifier; a name list alone is not authorization.

***

### signers

> **signers**: `string`[]

Claimed signer identities. On the pure `evaluateClaim` path these are the
(already verified) signer set. On the authoritative path they are only
checked for consistency with `signatures`.
