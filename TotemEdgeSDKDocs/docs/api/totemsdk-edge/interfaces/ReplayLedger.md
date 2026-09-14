[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / ReplayLedger

# Interface: ReplayLedger

Replay ledger — persists enough information to answer
"have I already processed this exact signed message?"

The `claim` operation is ATOMIC: two identical messages arriving
concurrently cannot both observe "not present" before either records the
result. Exactly one caller wins the claim; the other takes the replay path.

If a claim is PROCESSING past its lease, a subsequent claim reclaims it
(safe because the engine's negotiate CAS is idempotency-protected).

## Methods

### claim()

> **claim**(`messageId`, `receivedAt`, `leaseMs?`): `Promise`\<\{ `claimed`: `true`; `reclaimed?`: `boolean`; \} \| \{ `claimed`: `false`; `entry?`: [`ReplayEntry`](../type-aliases/ReplayEntry.md); \}\>

Atomically claim a message for processing. Returns `{ claimed: true }`
when this caller won the claim, `{ claimed: false, outcome }` when the
message was already completed, or `{ claimed: true, reclaimed: true }`
when a stale lease was reclaimed.

#### Parameters

##### messageId

`string`

##### receivedAt

`number`

##### leaseMs?

`number`

#### Returns

`Promise`\<\{ `claimed`: `true`; `reclaimed?`: `boolean`; \} \| \{ `claimed`: `false`; `entry?`: [`ReplayEntry`](../type-aliases/ReplayEntry.md); \}\>

***

### complete()

> **complete**(`messageId`, `outcome`): `Promise`\<`void`\>

Mark a claimed message as durably processed with its outcome.

#### Parameters

##### messageId

`string`

##### outcome

[`ReplayOutcome`](ReplayOutcome.md)

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`messageId`): `Promise`\<[`ReplayEntry`](../type-aliases/ReplayEntry.md) \| `undefined`\>

Look up a previously processed message.

#### Parameters

##### messageId

`string`

#### Returns

`Promise`\<[`ReplayEntry`](../type-aliases/ReplayEntry.md) \| `undefined`\>
