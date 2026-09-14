[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / AuthorityPolicy

# Class: AuthorityPolicy

AuthorityPolicy — bridges PolicyMiddleware evaluation with mandate-based
authority verification.

Corrected bridge:
 - uses the authenticated `proposal.principal` (never `agentId` as principal);
 - preserves the real action namespace (no synthesized `payment:*`);
 - returns the full `AuthorityDecision` + usage delta, not a boolean;
 - binds the decision to the proposal id as the intent nonce.

Insert this layer into a ComposablePolicy pipeline to ensure every proposal
is backed by a valid mandate before it is approved.

## Implements

- [`PolicyMiddleware`](../interfaces/PolicyMiddleware.md)

## Constructors

### Constructor

> **new AuthorityPolicy**(`evaluator`, `extractAction?`, `options?`): `AuthorityPolicy`

#### Parameters

##### evaluator

[`AuthorityEvaluator`](../interfaces/AuthorityEvaluator.md)

##### extractAction?

(`proposal`) => [`AuthorityActionIntent`](../interfaces/AuthorityActionIntent.md)

##### options?

[`AuthorityPolicyOptions`](../interfaces/AuthorityPolicyOptions.md)

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
