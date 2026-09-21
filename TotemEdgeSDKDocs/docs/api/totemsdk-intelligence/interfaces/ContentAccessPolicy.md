[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / ContentAccessPolicy

# Interface: ContentAccessPolicy

## Properties

### entitlements

> **entitlements**: readonly [`ContentWorkspaceEntitlement`](ContentWorkspaceEntitlement.md)[]

Latest authoritative entitlement snapshot. Change this to revoke —
retrieval is gated once the change is observed; no cleanup follows.

***

### freshnessMs?

> `optional` **freshnessMs?**: `number`

Freshness/offline policy: how stale the snapshot may be before denial.
When `freshnessMs` is set and `now - observedAt > freshnessMs`, protected
ops are denied (fail-closed while offline/stale).

***

### now?

> `optional` **now?**: () => `number`

Injectable clock (defaults to `Date.now`).

#### Returns

`number`

***

### observedAt?

> `optional` **observedAt?**: `number`

Wall-clock time `entitlements` was observed (defaults to `now` at use).

***

### onDeny?

> `optional` **onDeny?**: (`principal`, `op`, `reason`) => `void`

Diagnostic hook invoked on every denial.

#### Parameters

##### principal

`string` \| `undefined`

##### op

`string`

##### reason

`string`

#### Returns

`void`
