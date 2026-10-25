[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / OmniaObservation

# Interface: OmniaObservation

## Properties

### after?

> `optional` **after?**: `Record`\<`string`, `unknown`\>

***

### amounts?

> `optional` **amounts?**: `object`

#### amountAtoms?

> `optional` **amountAtoms?**: `string`

#### balances?

> `optional` **balances?**: `Record`\<`string`, `string`\>

#### capacity?

> `optional` **capacity?**: `string`

#### fee?

> `optional` **fee?**: `string`

***

### before?

> `optional` **before?**: `Record`\<`string`, `unknown`\>

***

### causationId?

> `optional` **causationId?**: `string`

The command/message that caused this transition.

***

### chain?

> `optional` **chain?**: `object`

#### blockHeight?

> `optional` **blockHeight?**: `number`

#### confirmations?

> `optional` **confirmations?**: `number`

#### fundingCoinId?

> `optional` **fundingCoinId?**: `string`

#### txDigest?

> `optional` **txDigest?**: `string`

#### txpowId?

> `optional` **txpowId?**: `string`

***

### data?

> `optional` **data?**: `Record`\<`string`, `unknown`\>

Free-form, already-redacted extras.

***

### domain

> **domain**: [`ObservationDomain`](../type-aliases/ObservationDomain.md)

***

### entity

> **entity**: [`ObservationEntity`](ObservationEntity.md)

***

### eventId

> **eventId**: `string`

***

### evidence?

> `optional` **evidence?**: `object`

#### leaseIndices?

> `optional` **leaseIndices?**: `number`[]

#### manifestId?

> `optional` **manifestId?**: `string`

#### peerPublicKeyDigest?

> `optional` **peerPublicKeyDigest?**: `string`

#### proofRefs?

> `optional` **proofRefs?**: `string`[]

#### signatureHashes?

> `optional` **signatureHashes?**: `string`[]

#### stateDigest?

> `optional` **stateDigest?**: `string`

***

### kind

> **kind**: `string`

***

### networkId

> **networkId**: `string`

***

### occurredAt

> **occurredAt**: `number`

***

### operationId?

> `optional` **operationId?**: `string`

Caller-known operation correlation (propagated where peer messages allow).

***

### parties?

> `optional` **parties?**: `object`

#### local?

> `optional` **local?**: `string`

#### remote?

> `optional` **remote?**: `string`

***

### phase

> **phase**: [`ObservationPhase`](../type-aliases/ObservationPhase.md)

***

### recordedAt

> **recordedAt**: `number`

***

### schemaVersion

> **schemaVersion**: `1`

***

### simulated

> **simulated**: `boolean`

True when the transition was simulated/fixture-backed.

***

### sourceNodeId

> **sourceNodeId**: `string`

***

### sourceSequence

> **sourceSequence**: `number`

Journal-assigned 1-based sequence (the resumable cursor).

***

### streamId

> **streamId**: `string`

***

### token?

> `optional` **token?**: `object`

#### scale

> **scale**: `number`

#### tokenId

> **tokenId**: `string`

***

### transitionHash?

> `optional` **transitionHash?**: `string`

Protocol-level identity of the underlying signed transition, if known.
