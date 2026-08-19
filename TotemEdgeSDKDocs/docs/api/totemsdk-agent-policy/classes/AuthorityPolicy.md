[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / AuthorityPolicy

# Class: AuthorityPolicy

AuthorityPolicy — bridges PolicyMiddleware evaluation with mandate-based
authority verification.

Insert this layer into a ComposablePolicy pipeline to ensure every
proposal is backed by a valid mandate before it is approved.

The caller provides an `AuthorityEvaluator` that encapsulates the
full mandate verification (crypto, scope, constraints, usage limits).

## Example

```ts
import { evaluateAuthority } from '@totemsdk/authority';

const authorityCheck = new AuthorityPolicy({
  async evaluate({ action, now }) {
    const { decision } = evaluateAuthority({ ... });
    return { allowed: decision.allowed, reason: decision.reason };
  },
});

const policy = new ComposablePolicy([
  new RateLimitPolicy(10, 60_000),
  authorityCheck,
]);
```

## Implements

- [`PolicyMiddleware`](../interfaces/PolicyMiddleware.md)

## Constructors

### Constructor

> **new AuthorityPolicy**(`evaluator`, `extractAction?`): `AuthorityPolicy`

#### Parameters

##### evaluator

[`AuthorityEvaluator`](../interfaces/AuthorityEvaluator.md)

##### extractAction?

(`proposal`) => [`AuthorityActionIntent`](../interfaces/AuthorityActionIntent.md)

#### Returns

`AuthorityPolicy`

## Methods

### evaluate()

> **evaluate**(`proposal`, `now?`): `Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

Evaluate a proposal. Called in sequence by ComposablePolicy.

#### Parameters

##### proposal

[`AgentProposal`](../interfaces/AgentProposal.md)

##### now?

`number` = `...`

#### Returns

`Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

#### Implementation of

[`PolicyMiddleware`](../interfaces/PolicyMiddleware.md).[`evaluate`](../interfaces/PolicyMiddleware.md#evaluate)
