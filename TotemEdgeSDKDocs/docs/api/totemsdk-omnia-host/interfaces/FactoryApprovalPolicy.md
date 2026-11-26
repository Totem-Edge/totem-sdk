[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / FactoryApprovalPolicy

# Interface: FactoryApprovalPolicy

## Properties

### allowedPeers?

> `optional` **allowedPeers?**: `string`[]

When set, only these peer public-key digests may be auto-approved.

***

### audit?

> `optional` **audit?**: (`event`) => `void` \| `Promise`\<`void`\>

Audit sink for every decision.

#### Parameters

##### event

[`FactoryApprovalEvent`](FactoryApprovalEvent.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### authorize?

> `optional` **authorize?**: [`FactoryAuthorizer`](../type-aliases/FactoryAuthorizer.md)

Operator/approval-service hook. Receiving an authorizer means the deployment
takes responsibility for the decision; it may throw to deny.

***

### autoApprove?

> `optional` **autoApprove?**: `boolean`

Explicit opt-in for unattended signing. Deny remains the default.

***

### maxTotalValue?

> `optional` **maxTotalValue?**: `bigint`

Upper bound for an automatically approved factory, in base units.
