[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / CoordinationStore

# Interface: CoordinationStore

## Methods

### deleteProposal()

> **deleteProposal**(`correlationId`): `Promise`\<`boolean`\>

#### Parameters

##### correlationId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### getProposal()

> **getProposal**(`correlationId`): `Promise`\<[`ProposalRecord`](ProposalRecord.md) \| `null`\>

#### Parameters

##### correlationId

`string`

#### Returns

`Promise`\<[`ProposalRecord`](ProposalRecord.md) \| `null`\>

***

### listAcceptances()

> **listAcceptances**(`correlationId`): `Promise`\<[`AcceptanceRecord`](AcceptanceRecord.md)[]\>

#### Parameters

##### correlationId

`string`

#### Returns

`Promise`\<[`AcceptanceRecord`](AcceptanceRecord.md)[]\>

***

### putProposal()

> **putProposal**(`record`): `Promise`\<`void`\>

#### Parameters

##### record

[`ProposalRecord`](ProposalRecord.md)

#### Returns

`Promise`\<`void`\>

***

### recordAcceptance()

> **recordAcceptance**(`correlationId`, `partyId`, `message`): `Promise`\<`boolean`\>

Idempotent: returns false when this party already had an acceptance.

#### Parameters

##### correlationId

`string`

##### partyId

`string`

##### message

[`OmniaMessage`](OmniaMessage.md)

#### Returns

`Promise`\<`boolean`\>

***

### setProposalState()

> **setProposalState**(`correlationId`, `state`): `Promise`\<`void`\>

#### Parameters

##### correlationId

`string`

##### state

[`ProposalState`](../type-aliases/ProposalState.md)

#### Returns

`Promise`\<`void`\>
