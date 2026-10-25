[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / EmitObservationInput

# Interface: EmitObservationInput

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

***

### domain

> **domain**: [`ObservationDomain`](../type-aliases/ObservationDomain.md)

***

### entity

> **entity**: [`ObservationEntity`](ObservationEntity.md)

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

### occurredAt?

> `optional` **occurredAt?**: `number`

***

### operationId?

> `optional` **operationId?**: `string`

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

### simulated?

> `optional` **simulated?**: `boolean`

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
