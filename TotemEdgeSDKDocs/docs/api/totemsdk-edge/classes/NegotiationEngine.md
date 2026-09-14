[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / NegotiationEngine

# Class: NegotiationEngine

## Constructors

### Constructor

> **new NegotiationEngine**(`opts`): `NegotiationEngine`

#### Parameters

##### opts

[`NegotiationEngineOptions`](../interfaces/NegotiationEngineOptions.md)

#### Returns

`NegotiationEngine`

## Methods

### acceptProposal()

> **acceptProposal**(`acceptance`): `Promise`\<[`TradeAgreement`](../interfaces/TradeAgreement.md)\>

Accept the current proposal head. Binds the exact current proposal.
Returns the immutable TradeAgreement.

#### Parameters

##### acceptance

[`ProposalAcceptance`](../interfaces/ProposalAcceptance.md)

#### Returns

`Promise`\<[`TradeAgreement`](../interfaces/TradeAgreement.md)\>

***

### buildAction()

> **buildAction**(`proposal`): `MachineWorkAction`

Build a MachineWorkAction for a proposal (binds all security-relevant
fields). Used both for mining and verification.

#### Parameters

##### proposal

[`TradeProposal`](../interfaces/TradeProposal.md)

#### Returns

`MachineWorkAction`

***

### cancelNegotiation()

> **cancelNegotiation**(`cancellation`): `Promise`\<`void`\>

Cancel a negotiation.

#### Parameters

##### cancellation

[`NegotiationCancellation`](../interfaces/NegotiationCancellation.md)

#### Returns

`Promise`\<`void`\>

***

### getCumulativeWork()

> **getCumulativeWork**(`negotiationId`): `Promise`\<`bigint`\>

Get cumulative work spent in a negotiation.

#### Parameters

##### negotiationId

`string`

#### Returns

`Promise`\<`bigint`\>

***

### getHistory()

> **getHistory**(`negotiationId`): `Promise`\<[`TradeProposal`](../interfaces/TradeProposal.md)[]\>

Get the proposal history for a negotiation.

#### Parameters

##### negotiationId

`string`

#### Returns

`Promise`\<[`TradeProposal`](../interfaces/TradeProposal.md)[]\>

***

### getIssuedChallenge()

> **getIssuedChallenge**(`negotiationId`, `round`): `WorkChallenge` \| `undefined`

Retrieve a previously issued or received challenge for a round.

#### Parameters

##### negotiationId

`string`

##### round

`number`

#### Returns

`WorkChallenge` \| `undefined`

***

### getRecordFor()

> **getRecordFor**(`negotiationId`): `Promise`\<[`NegotiationRecord`](../interfaces/NegotiationRecord.md) \| `undefined`\>

Get the durable record for a negotiation.

#### Parameters

##### negotiationId

`string`

#### Returns

`Promise`\<[`NegotiationRecord`](../interfaces/NegotiationRecord.md) \| `undefined`\>

***

### getState()

> **getState**(`negotiationId`): `Promise`\<[`NegotiationState`](../type-aliases/NegotiationState.md) \| `undefined`\>

Get the current state of a negotiation.

#### Parameters

##### negotiationId

`string`

#### Returns

`Promise`\<[`NegotiationState`](../type-aliases/NegotiationState.md) \| `undefined`\>

***

### getTermsHashes()

> **getTermsHashes**(`negotiationId`): `Promise`\<`string`[]\>

Get the terms hashes for a negotiation (for cycle detection).

#### Parameters

##### negotiationId

`string`

#### Returns

`Promise`\<`string`[]\>

***

### handleWorkRequired()

> **handleWorkRequired**(`msg`): `Promise`\<`WorkChallenge`\>

Handle an inbound WorkRequired. Validates issuer signature, recipient,
negotiation state, and that only one outstanding WorkRequired exists for
the current head. Returns the challenge when acceptable.

#### Parameters

##### msg

[`WorkRequired`](../interfaces/WorkRequired.md)

#### Returns

`Promise`\<`WorkChallenge`\>

***

### issueChallenge()

> **issueChallenge**(`negotiationId`): `Promise`\<[`WorkRequired`](../interfaces/WorkRequired.md)\>

Issue a WorkRequired challenge for the next round from this engine.

Persists the challenge locally as outstanding so that a future proposal
mined against it can be verified. Validates local work policy and budget
before issuing.

#### Parameters

##### negotiationId

`string`

#### Returns

`Promise`\<[`WorkRequired`](../interfaces/WorkRequired.md)\>

***

### openNegotiation()

> **openNegotiation**(`opts`): `Promise`\<[`NegotiationRecord`](../interfaces/NegotiationRecord.md)\>

Open a new negotiation. Enforces per-principal concurrency, cooldown, and
window limits ATOMICALLY (check + consume is one operation). Returns the
negotiation record.

#### Parameters

##### opts

###### counterparty

`string`

###### expiresAt?

`number`

###### manifestId

`string`

###### negotiationId

`string`

#### Returns

`Promise`\<[`NegotiationRecord`](../interfaces/NegotiationRecord.md)\>

***

### reconcilePrincipalSlots()

> **reconcilePrincipalSlots**(): `Promise`\<`void`\>

Reconcile principal admission slots against currently-active negotiation
records. Any slot whose negotiation is terminal, expired, or missing is
released. Invoke after restart to prevent capacity leaks.

#### Returns

`Promise`\<`void`\>

***

### rejectProposal()

> **rejectProposal**(`rejection`): `Promise`\<`void`\>

Reject the current proposal head.

#### Parameters

##### rejection

[`ProposalRejection`](../interfaces/ProposalRejection.md)

#### Returns

`Promise`\<`void`\>

***

### submitProposal()

> **submitProposal**(`proposal`): `Promise`\<[`NegotiationRecord`](../interfaces/NegotiationRecord.md)\>

Submit a proposal (initial or counter). Enforces every bound atomically.
Returns the updated record.

#### Parameters

##### proposal

[`TradeProposal`](../interfaces/TradeProposal.md)

#### Returns

`Promise`\<[`NegotiationRecord`](../interfaces/NegotiationRecord.md)\>
