[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / WatchPolicyConfig

# Interface: WatchPolicyConfig

## Properties

### afterEpoch?

> `optional` **afterEpoch?**: `number`

Only notify for epochs after this value.

***

### onUpdate

> **onUpdate**: (`update`) => `void`

Called when the policy is updated.

#### Parameters

##### update

[`PolicyUpdateNotification`](PolicyUpdateNotification.md)

#### Returns

`void`

***

### policyId

> **policyId**: `string`

The policy to watch.
