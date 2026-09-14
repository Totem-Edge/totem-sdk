[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / AuthorityEvaluator

# Interface: AuthorityEvaluator

Authority evaluation interface — the caller injects their authority engine
(e.g. `@totemsdk/authority`'s `evaluateAuthority`).

## Methods

### evaluate()

> **evaluate**(`params`): `Promise`\<[`AuthorityDecisionResult`](AuthorityDecisionResult.md)\>

#### Parameters

##### params

###### action

[`AuthorityActionIntent`](AuthorityActionIntent.md)

###### now

`number`

#### Returns

`Promise`\<[`AuthorityDecisionResult`](AuthorityDecisionResult.md)\>
