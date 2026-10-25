[**@totemsdk/eefi**](../index.md)

***

[@totemsdk/eefi](../index.md) / EefiFundingTerms

# Interface: EefiFundingTerms

`@totemsdk/eefi` — neutral Eefi generic contracts (RFC-050 §5).

Data + canonical digests + validation only. Enforcement primitives live in
lower layers (`kissvm` covenants, `proof` oracle policy, `edge` negotiation,
`omnia` execution). Product-specific terms belong to the product layer.

## Properties

### allowedProgramHash

> **allowedProgramHash**: `string`

Hash of the exact Omnia program the capital may fund.

***

### assetId

> **assetId**: `string`

Asset ID (native Minima is `0x00`).

***

### counterparties?

> `optional` **counterparties?**: `string`[]

Optional allow-list of counterparties; absent means permissionless.

***

### mashPolicyRoot

> **mashPolicyRoot**: `string`

MSHS-2 policy root authorising capital entry.

***

### maxAmountAtoms

> **maxAmountAtoms**: `string`

Maximum deployable amount, in atoms.
