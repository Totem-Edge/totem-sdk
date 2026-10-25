[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / aggregateConfidence

# Function: aggregateConfidence()

> **aggregateConfidence**(`decision`): `number` \| `undefined`

Aggregate confidence for a decision.

For batched questions this is the **minimum** across answers; if any answer
lacks a confidence value the aggregate is `undefined` (so `minConfidence`
treats a missing confidence as a failure).

## Parameters

### decision

[`DecisionResult`](../type-aliases/DecisionResult.md)

## Returns

`number` \| `undefined`
