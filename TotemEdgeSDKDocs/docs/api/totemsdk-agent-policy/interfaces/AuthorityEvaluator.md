[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / AuthorityEvaluator

# Interface: AuthorityEvaluator

Minimal authority evaluation interface — the caller injects their
authority engine (e.g. `@totemsdk/authority`'s `evaluateAuthority`).

This keeps `@totemsdk/agent-policy` free of a hard dependency on
`@totemsdk/authority`.

## Methods

### evaluate()

> **evaluate**(`params`): `Promise`\<\{ `allowed`: `boolean`; `reason?`: `string`; \}\>

#### Parameters

##### params

###### action

[`AuthorityActionIntent`](AuthorityActionIntent.md)

###### now

`number`

#### Returns

`Promise`\<\{ `allowed`: `boolean`; `reason?`: `string`; \}\>
