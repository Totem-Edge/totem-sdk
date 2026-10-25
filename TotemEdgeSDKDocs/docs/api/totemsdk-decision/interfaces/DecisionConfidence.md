[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionConfidence

# Interface: DecisionConfidence

Confidence annotation. Never present a provider `0.92` as "92% calibrated
correctness" — calibration is only asserted when the provider reports it.

## Properties

### calibrated?

> `readonly` `optional` **calibrated?**: `boolean`

***

### source

> `readonly` **source**: `"provider"` \| `"selected_probability"` \| `"derived"`

***

### value

> `readonly` **value**: `number`
