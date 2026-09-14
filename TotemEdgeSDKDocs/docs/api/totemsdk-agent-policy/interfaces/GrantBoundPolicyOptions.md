[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / GrantBoundPolicyOptions

# Interface: GrantBoundPolicyOptions

## Properties

### identityResolver

> **identityResolver**: `AuthorityIdentityResolver`

***

### localBounds?

> `optional` **localBounds?**: [`LocalBounds`](LocalBounds.md)

***

### mandateResolver

> **mandateResolver**: (`mandateId`) => `Promise`\<`SignedProof` \| `undefined`\>

Resolve a signed mandate proof by id.

#### Parameters

##### mandateId

`string`

#### Returns

`Promise`\<`SignedProof` \| `undefined`\>

***

### mandateStatusResolver?

> `optional` **mandateStatusResolver?**: () => `Promise`\<`MandateStatusSnapshot`\>

Resolve current epoch / revocation state.

#### Returns

`Promise`\<`MandateStatusSnapshot`\>

***

### now?

> `optional` **now?**: () => `number`

Injectable clock (defaults to Date.now).

#### Returns

`number`

***

### usageStore

> **usageStore**: [`GrantUsageStore`](GrantUsageStore.md)
