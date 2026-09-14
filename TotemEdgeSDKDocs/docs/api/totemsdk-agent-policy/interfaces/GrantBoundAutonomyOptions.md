[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / GrantBoundAutonomyOptions

# Interface: GrantBoundAutonomyOptions

## Properties

### autonomyProfiles

> **autonomyProfiles**: `Record`\<`string`, [`AutonomyProfile`](AutonomyProfile.md)\>

***

### grantRequirements?

> `optional` **grantRequirements?**: `Record`\<`string`, [`GrantRequirement`](GrantRequirement.md)\>

Grant-set composition, keyed by action string.

***

### identityResolver

> **identityResolver**: `AuthorityIdentityResolver`

***

### mandateResolver

> **mandateResolver**: (`mandateId`) => `Promise`\<`SignedProof` \| `undefined`\>

#### Parameters

##### mandateId

`string`

#### Returns

`Promise`\<`SignedProof` \| `undefined`\>

***

### mandateStatusResolver?

> `optional` **mandateStatusResolver?**: () => `Promise`\<`MandateStatusSnapshot`\>

#### Returns

`Promise`\<`MandateStatusSnapshot`\>

***

### now?

> `optional` **now?**: () => `number`

#### Returns

`number`

***

### stateStore?

> `optional` **stateStore?**: [`RunStateStore`](RunStateStore.md)
