[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / RecipientAllowlistPolicy

# Class: RecipientAllowlistPolicy

RecipientAllowlistPolicy — only allows proposals whose recipient
address appears in a predefined allowlist. Proposals without a
recipient pass through (lookups, receipts).

Addresses are compared as case-sensitive strings. Include all
valid address formats (Mx-prefixed, 0x-prefixed, raw hex) that
your agents may use.

## Example

```ts
const allowlist = new RecipientAllowlistPolicy([
  'MxABC...',   // supplier A
  'MxDEF...',   // supplier B
]);
```

## Implements

- [`PolicyMiddleware`](../interfaces/PolicyMiddleware.md)

## Constructors

### Constructor

> **new RecipientAllowlistPolicy**(`allowedAddresses`): `RecipientAllowlistPolicy`

#### Parameters

##### allowedAddresses

`string`[]

#### Returns

`RecipientAllowlistPolicy`

## Methods

### evaluate()

> **evaluate**(`proposal`): `Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

Evaluate a proposal. Called in sequence by ComposablePolicy.

#### Parameters

##### proposal

[`AgentProposal`](../interfaces/AgentProposal.md)

#### Returns

`Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

#### Implementation of

[`PolicyMiddleware`](../interfaces/PolicyMiddleware.md).[`evaluate`](../interfaces/PolicyMiddleware.md#evaluate)
