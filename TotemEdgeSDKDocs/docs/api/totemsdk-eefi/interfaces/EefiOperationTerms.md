[**@totemsdk/eefi**](../index.md)

***

[@totemsdk/eefi](../index.md) / EefiOperationTerms

# Interface: EefiOperationTerms

`@totemsdk/eefi` — neutral Eefi generic contracts (RFC-050 §5).

Data + canonical digests + validation only. Enforcement primitives live in
lower layers (`kissvm` covenants, `proof` oracle policy, `edge` negotiation,
`omnia` execution). Product-specific terms belong to the product layer.

## Properties

### channelProgramId

> **channelProgramId**: `string`

Omnia channel program identifier.

***

### conditionPolicyId?

> `optional` **conditionPolicyId?**: `string`

Optional oracle/condition policy the operation is bound to.

***

### maturityBlock

> **maturityBlock**: `string`

Maturity / expiry block height, as a decimal string.

***

### stateRulesHash

> **stateRulesHash**: `string`

Hash of the committed state-transition rules.
