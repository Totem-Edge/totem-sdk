[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / QueryPolicyConfig

# Interface: QueryPolicyConfig

## Properties

### activeOnly?

> `optional` **activeOnly?**: `boolean`

Only return active (non-expired, non-revoked) policies.

***

### authorityIdentityId?

> `optional` **authorityIdentityId?**: `string`

Find policies by authority identity.

***

### capability?

> `optional` **capability?**: `string`

Find policies supporting a specific capability.

***

### limit?

> `optional` **limit?**: `number`

Maximum number of results.

***

### minEpoch?

> `optional` **minEpoch?**: `number`

Minimum policy epoch.

***

### minVersion?

> `optional` **minVersion?**: `number`

Minimum policy version.

***

### policyId?

> `optional` **policyId?**: `string`

Find a specific policy by ID.

***

### policyRoot?

> `optional` **policyRoot?**: `string`

Find policies by root hash.

***

### subjectId?

> `optional` **subjectId?**: `string`

Find policies for a specific subject (vehicle, machine, device).
