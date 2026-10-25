[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionValue

# Type Alias: DecisionValue

> **DecisionValue** = [`DecisionScalar`](DecisionScalar.md) \| readonly `DecisionValue`[] \| \{\[`key`: `string`\]: `DecisionValue`; \}

A canonical, JSON-compatible decision value. Large binaries are never
embedded — they are referenced by digest/evidence id.
