[**@totemsdk/eefi**](../index.md)

***

[@totemsdk/eefi](../index.md) / EefiSettlementTerms

# Interface: EefiSettlementTerms

`@totemsdk/eefi` — neutral Eefi generic contracts (RFC-050 §5).

Data + canonical digests + validation only. Enforcement primitives live in
lower layers (`kissvm` covenants, `proof` oracle policy, `edge` negotiation,
`omnia` execution). Product-specific terms belong to the product layer.

## Properties

### collateralCommitment?

> `optional` **collateralCommitment?**: `string`

Optional collateral commitment (bond / liquidation).

***

### payoutPolicyHash

> **payoutPolicyHash**: `string`

Hash of the exact payout policy (beneficiaries + amounts).

***

### recoveryPolicyHash

> **recoveryPolicyHash**: `string`

Hash of the fallback / owner-recovery policy.
