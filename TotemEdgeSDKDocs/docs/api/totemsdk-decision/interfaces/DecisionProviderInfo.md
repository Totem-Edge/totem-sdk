[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionProviderInfo

# Interface: DecisionProviderInfo

Structural provenance. Aids routing; grants nothing. Missing fields are
omitted, never invented.

## Properties

### choiceSelection?

> `readonly` `optional` **choiceSelection?**: `"provider"` \| `"argmax"`

Provider contract for choice selection. `'argmax'` requires the selected
candidate to be the distribution maximum (Laya/Jev); `'provider'` (default)
trusts the provider's selection.

***

### distributionTolerance?

> `readonly` `optional` **distributionTolerance?**: `number`

Provider-specific tolerance for a complete distribution's sum ≈ 1. Typed
clients whose contract rounds (e.g. Laya at 4 dp, Jev < 0.02) declare a
contract-appropriate value; deterministic providers keep the 1e-6 default.

***

### locality?

> `readonly` `optional` **locality?**: [`DecisionLocality`](../type-aliases/DecisionLocality.md)

***

### maxCandidatesPerQuestion?

> `readonly` `optional` **maxCandidatesPerQuestion?**: `number`

***

### maxOperations?

> `readonly` `optional` **maxOperations?**: `number`

***

### maxQuestions?

> `readonly` `optional` **maxQuestions?**: `number`

***

### maxStateBytes?

> `readonly` `optional` **maxStateBytes?**: `number`

***

### maxTargetsPerOperation?

> `readonly` `optional` **maxTargetsPerOperation?**: `number`

***

### model?

> `readonly` `optional` **model?**: [`DecisionModelRef`](DecisionModelRef.md)

***

### runtime?

> `readonly` `optional` **runtime?**: [`DecisionRuntimeRef`](DecisionRuntimeRef.md)

***

### supportedTypes?

> `readonly` `optional` **supportedTypes?**: readonly [`DecisionType`](../type-aliases/DecisionType.md)[]
