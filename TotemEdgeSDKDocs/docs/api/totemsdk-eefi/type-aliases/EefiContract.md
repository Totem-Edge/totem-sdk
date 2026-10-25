[**@totemsdk/eefi**](../index.md)

***

[@totemsdk/eefi](../index.md) / EefiContract

# Type Alias: EefiContract

> **EefiContract** = [`EefiCapitalAgreement`](../interfaces/EefiCapitalAgreement.md) \| [`EefiMarketAgreement`](../interfaces/EefiMarketAgreement.md) \| [`EefiRiskPolicyRef`](../interfaces/EefiRiskPolicyRef.md) \| [`EefiExerciseCovenant`](../interfaces/EefiExerciseCovenant.md)

`@totemsdk/eefi` — neutral Eefi generic contracts (RFC-050 §5).

Data + canonical digests + validation only. Enforcement primitives live in
lower layers (`kissvm` covenants, `proof` oracle policy, `edge` negotiation,
`omnia` execution). Product-specific terms belong to the product layer.
