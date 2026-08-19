[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / RecursiveMastPolicyManifest

# Interface: RecursiveMastPolicyManifest

## Properties

### actions

> **actions**: [`PolicyAction`](PolicyAction.md)[]

Available actions.

***

### anchorAddress

> **anchorAddress**: `string`

The address of the Policy Anchor Coin.

***

### anchorCoinId?

> `optional` **anchorCoinId?**: `string`

The coin ID of the Policy Anchor Coin (if on-chain).

***

### authorityPkd?

> `optional` **authorityPkd?**: `string`

The public key digest that signed the manifest.

***

### authoritySignature?

> `optional` **authoritySignature?**: `string`

Signature by the policy's institutional authority.

***

### endpoints

> **endpoints**: [`PolicyEndpoint`](PolicyEndpoint.md)[]

Communication endpoints.

***

### epoch

> **epoch**: `number`

Current policy epoch.

***

### expiresAt?

> `optional` **expiresAt?**: `number`

Block height at which this policy expires (optional).

***

### policyId

> **policyId**: `string`

Unique policy identifier.

***

### policyPackageHash

> **policyPackageHash**: `string`

SHA3-256 of the complete policy package (scripts + proofs + metadata).

***

### policyRoot

> **policyRoot**: `string`

The Merkle root of the policy's MAST script tree.

***

### previousVersion?

> `optional` **previousVersion?**: `string`

Previous version's policyId (for chain verification).

***

### roles

> **roles**: [`PolicyRole`](PolicyRole.md)[]

Roles defined in this policy.

***

### signedAt?

> `optional` **signedAt?**: `number`

Timestamp of signing.

***

### status

> **status**: `"draft"` \| `"active"` \| `"superseded"` \| `"revoked"`

Policy status.

***

### subject

> **subject**: `object`

The subject being governed.

#### id

> **id**: `string`

#### type

> **type**: `"site"` \| `"vehicle"` \| `"machine"` \| `"device"` \| `"fleet"` \| `"building"`

***

### successorVersion?

> `optional` **successorVersion?**: `string`

Next version's policyId (if superseded).

***

### validFrom

> **validFrom**: `number`

Block height from which this policy is valid.

***

### version

> **version**: `number`

Policy version number.
