[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / ProviderDecisionValidationOptions

# Interface: ProviderDecisionValidationOptions

Provider-decision validation options derived from the provider's declared
contract (`DecisionProviderInfo`).

## Properties

### choiceSelection?

> `readonly` `optional` **choiceSelection?**: `"provider"` \| `"argmax"`

Enforce argmax selection when the provider contract requires it.

***

### tolerance?

> `readonly` `optional` **tolerance?**: `number`

Tolerance for a complete distribution's sum. Defaults to 1e-6.
