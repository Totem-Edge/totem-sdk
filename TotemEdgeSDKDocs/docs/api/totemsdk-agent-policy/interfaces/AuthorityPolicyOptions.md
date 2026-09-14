[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / AuthorityPolicyOptions

# Interface: AuthorityPolicyOptions

## Properties

### now?

> `optional` **now?**: () => `number`

Injectable clock (defaults to Date.now).

#### Returns

`number`

***

### strictPrincipal?

> `optional` **strictPrincipal?**: `boolean`

When true, a proposal without an authenticated `proposal.principal` is
rejected outright. When false, the extractor falls back to `agentId`.
