[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeWorkPolicy

# Class: EdgeWorkPolicy

Edge work policy — answers "am I willing to perform this challenge?"

Cryptographic verification still depends on challenge.target, not local
timing estimates. The budget only gates whether the machine proceeds.

## Constructors

### Constructor

> **new EdgeWorkPolicy**(`mode`, `budget`, `difficulty`, `hashRatePerSec`): `EdgeWorkPolicy`

#### Parameters

##### mode

[`WorkMode`](../type-aliases/WorkMode.md)

##### budget

[`LocalWorkBudget`](../interfaces/LocalWorkBudget.md)

##### difficulty

[`WorkDifficultyPolicy`](../interfaces/WorkDifficultyPolicy.md)

##### hashRatePerSec

`number`

#### Returns

`EdgeWorkPolicy`

## Methods

### expectedHashes()

> **expectedHashes**(`targetHex`): `bigint`

Expected hashes for a target (exposed for telemetry).

#### Parameters

##### targetHex

`string`

#### Returns

`bigint`

***

### getMode()

> **getMode**(): [`WorkMode`](../type-aliases/WorkMode.md)

#### Returns

[`WorkMode`](../type-aliases/WorkMode.md)

***

### issueChallenge()

> **issueChallenge**(`params`): `Promise`\<\{ `challenge`: `WorkChallenge`; `workRequired`: [`WorkRequired`](../interfaces/WorkRequired.md); \}\>

Issue a WorkRequired challenge for the next round, bound by local policy.

The caller (engine or seller service) is responsible for sending the
challenge to the counterparty and persisting it as an outstanding
challenge in the negotiation record.

#### Parameters

##### params

###### domain?

`string`

###### issuer

`string`

###### negotiationId

`string`

###### now?

() => `number`

###### recipient

`string`

###### round

`number`

###### sign

(`digest`) => `Promise`\<\{ `signature`: `string`; `signerPublicKey`: `string`; \}\>

#### Returns

`Promise`\<\{ `challenge`: `WorkChallenge`; `workRequired`: [`WorkRequired`](../interfaces/WorkRequired.md); \}\>

***

### targetForRound()

> **targetForRound**(`round`): `string` \| `null`

Resolve the difficulty target for a given round, bounded by local policy.
Returns null when the round's target would exceed the configured maximum.

#### Parameters

##### round

`number`

#### Returns

`string` \| `null`

***

### willingToWork()

> **willingToWork**(`challenge`, `round`, `cumulativeWork`): `Promise`\<\{ `ok`: `boolean`; `reason?`: `string`; \}\>

Decide whether the machine is willing to perform a challenge for a given
round, given the cumulative work already spent in this negotiation.

#### Parameters

##### challenge

`WorkChallenge`

##### round

`number`

##### cumulativeWork

`bigint`

#### Returns

`Promise`\<\{ `ok`: `boolean`; `reason?`: `string`; \}\>
