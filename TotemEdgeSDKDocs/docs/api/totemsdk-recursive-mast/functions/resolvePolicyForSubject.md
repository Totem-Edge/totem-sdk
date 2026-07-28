[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / resolvePolicyForSubject

# Function: resolvePolicyForSubject()

> **resolvePolicyForSubject**(`client`, `config`): `Promise`\<[`ResolvedPolicy`](../interfaces/ResolvedPolicy.md) \| `null`\>

Resolve the current policy for a subject and action.

Queries the lookup network, filters by capability matching the action,
and returns the highest-epoch active policy.

## Parameters

### client

[`PolicyLookupClient`](../interfaces/PolicyLookupClient.md)

### config

[`ResolvePolicyConfig`](../interfaces/ResolvePolicyConfig.md)

## Returns

`Promise`\<[`ResolvedPolicy`](../interfaces/ResolvedPolicy.md) \| `null`\>
