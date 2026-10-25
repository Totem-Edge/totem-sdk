[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionProvenance

# Interface: DecisionProvenance

Provider provenance. Missing fields are omitted, never invented. Caller
declarations are never presented as verified facts.

## Properties

### locality?

> `readonly` `optional` **locality?**: [`DecisionLocality`](../type-aliases/DecisionLocality.md)

***

### model?

> `readonly` `optional` **model?**: [`DecisionModelRef`](DecisionModelRef.md)

***

### providerId

> `readonly` **providerId**: `string`

***

### providerVersion?

> `readonly` `optional` **providerVersion?**: `string`

***

### runtime?

> `readonly` `optional` **runtime?**: [`DecisionRuntimeRef`](DecisionRuntimeRef.md)

***

### source?

> `readonly` `optional` **source?**: `"declared"` \| `"provider-reported"` \| `"verified"`

***

### upstreamRequestId?

> `readonly` `optional` **upstreamRequestId?**: `string`
