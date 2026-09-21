[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / GrantBoundAutonomyOptions

# Interface: GrantBoundAutonomyOptions

## Properties

### autonomyProfiles

> **autonomyProfiles**: `Record`\<`string`, [`AutonomyProfile`](AutonomyProfile.md)\>

***

### ephemeral?

> `optional` **ephemeral?**: `boolean`

Explicitly permit the in-memory default store (dev/testing only).
Without it, construction fails rather than silently downgrading to an
ephemeral store that cannot recover reservations after a restart.

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
