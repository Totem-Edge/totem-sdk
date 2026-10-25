[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionShortlister

# Interface: DecisionShortlister

Optional candidate shortlister seam (RFC-012 §25). **Deferred for v0.1** —
exported as the future extension point but not invoked by the runtime. When
implemented it must run before provider-limit eligibility and must record the
original candidate-set digest, the effective candidate-set digest, the
shortlister identity, and the kept candidate IDs.

## Methods

### shortlist()

> **shortlist**(`params`): [`DecisionProviderRequest`](../type-aliases/DecisionProviderRequest.md) \| `Promise`\<[`DecisionProviderRequest`](../type-aliases/DecisionProviderRequest.md)\>

#### Parameters

##### params

###### provider

[`DecisionProvider`](DecisionProvider.md)

###### request

[`DecisionProviderRequest`](../type-aliases/DecisionProviderRequest.md)

#### Returns

[`DecisionProviderRequest`](../type-aliases/DecisionProviderRequest.md) \| `Promise`\<[`DecisionProviderRequest`](../type-aliases/DecisionProviderRequest.md)\>
