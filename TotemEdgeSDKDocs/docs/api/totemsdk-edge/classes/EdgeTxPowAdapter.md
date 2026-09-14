[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeTxPowAdapter

# Class: EdgeTxPowAdapter

TxPoW adapter — the only place Edge touches @totemsdk/txpow.

## Constructors

### Constructor

> **new EdgeTxPowAdapter**(`templateProvider`, `relay?`): `EdgeTxPowAdapter`

#### Parameters

##### templateProvider

`MinimaWorkTemplateProvider`

##### relay?

`MinimaWorkRelay`

#### Returns

`EdgeTxPowAdapter`

## Methods

### fingerprint()

> **fingerprint**(`challenge`): `string`

One-shot challenge fingerprint.

#### Parameters

##### challenge

`WorkChallenge`

#### Returns

`string`

***

### mine()

> **mine**(`action`, `challenge`, `opts?`): `Promise`\<`MachineWorkAdmissionProof`\>

Mine a Machine Work Admission proof for a proposal.

The action commitment binds negotiationId, proposalId, parentProposalId,
manifestId, proposer, recipient, round, terms hash, and proposal expiry.

NOTE: mining does NOT relay. Only the locally returned
verifyWorkAdmission() metadata may trigger block relay (see verify()).

#### Parameters

##### action

`MachineWorkAction`

##### challenge

`WorkChallenge`

##### opts?

###### _skipWorker?

`boolean`

###### forceJs?

`boolean`

###### maxIterations?

`number`

###### prng?

`Uint8Array`\<`ArrayBufferLike`\>

###### signal?

`AbortSignal`

#### Returns

`Promise`\<`MachineWorkAdmissionProof`\>

***

### verify()

> **verify**(`action`, `challenge`, `proof`): `Promise`\<`WorkAdmissionVerification`\>

Verify a Machine Work Admission proof.

Only the locally returned verification metadata may trigger block relay.
Relay is best-effort: a relay failure must never invalidate a valid
proposal or stall negotiation.

#### Parameters

##### action

`MachineWorkAction`

##### challenge

`WorkChallenge`

##### proof

`MachineWorkAdmissionProof`

#### Returns

`Promise`\<`WorkAdmissionVerification`\>
