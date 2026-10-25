[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / SignerPolicy

# Interface: SignerPolicy

Hosted/KMS policy checks applied before delegating to the underlying port.

## Properties

### allowedDomains?

> `optional` **allowedDomains?**: `SignDomain`[]

***

### allowedModes?

> `optional` **allowedModes?**: `CustodyMode`[]

***

### audit?

> `optional` **audit?**: (`record`) => `void` \| `Promise`\<`void`\>

Durable audit sink; called with allow/deny decisions.

#### Parameters

##### record

[`SignerAuditRecord`](SignerAuditRecord.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### authorize?

> `optional` **authorize?**: (`request`) => `void` \| `Promise`\<`void`\>

Additional operator approval hook (KMS/HSM/MPC or quorum).

#### Parameters

##### request

`SignRequest`

#### Returns

`void` \| `Promise`\<`void`\>

***

### custody?

> `optional` **custody?**: `object`

RFC-061 signer gate: exact disclosure acknowledgement + policy decision.

#### acknowledgement?

> `optional` **acknowledgement?**: `CustodyAcknowledgement`

#### now?

> `optional` **now?**: `number`

#### policyDecision?

> `optional` **policyDecision?**: `"allow"` \| `"deny"`

#### subjectId?

> `optional` **subjectId?**: `string`

***

### maxAmount?

> `optional` **maxAmount?**: `bigint`

Reject requests whose declared amount exceeds this value (base units).

***

### mfa?

> `optional` **mfa?**: `object`

RFC-061 D8: verify a request-scoped, operation-bound MFA assertion.
Defaults to non-self custody; a `minAmount` can scope it to larger moves.

#### minAmount?

> `optional` **minAmount?**: `bigint`

#### modes?

> `optional` **modes?**: `CustodyMode`[]

#### verify

> **verify**: (`request`) => `void` \| `Promise`\<`void`\>

##### Parameters

###### request

`SignRequest`

##### Returns

`void` \| `Promise`\<`void`\>

***

### requireDisclosure?

> `optional` **requireDisclosure?**: `boolean`

Require a disclosure hash/version on the custody context.
