[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / PolicyLookupClient

# Interface: PolicyLookupClient

## Methods

### announcePolicy()

> **announcePolicy**(`manifest`, `metadata`): `Promise`\<`void`\>

Announce a policy manifest to the network.

#### Parameters

##### manifest

`Uint8Array`

##### metadata

###### authorityIdentityId

`string`

###### capabilities

`string`[]

###### expiresAt

`number`

###### policyEpoch

`number`

###### policyId

`string`

###### policyRoot

`string`

###### policyVersion

`number`

###### subjectId

`string`

#### Returns

`Promise`\<`void`\>

***

### queryPolicies()

> **queryPolicies**(`params`): `Promise`\<[`PolicyQueryResult`](PolicyQueryResult.md)[]\>

Query the network for policies.

#### Parameters

##### params

###### activeOnly?

`boolean`

###### authorityIdentityId?

`string`

###### capability?

`string`

###### limit?

`number`

###### minEpoch?

`number`

###### minVersion?

`number`

###### policyId?

`string`

###### policyRoot?

`string`

###### subjectId?

`string`

#### Returns

`Promise`\<[`PolicyQueryResult`](PolicyQueryResult.md)[]\>

***

### watchPolicy()

> **watchPolicy**(`policyId`, `afterEpoch`, `onUpdate`): () => `void`

Watch for policy updates.

#### Parameters

##### policyId

`string`

##### afterEpoch

`number`

##### onUpdate

(`update`) => `void`

#### Returns

() => `void`
