[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / InMemoryReplayLedger

# Class: InMemoryReplayLedger

In-memory replay ledger (dev/test). Atomic within a single process.

## Implements

- [`ReplayLedger`](../interfaces/ReplayLedger.md)

## Constructors

### Constructor

> **new InMemoryReplayLedger**(): `InMemoryReplayLedger`

#### Returns

`InMemoryReplayLedger`

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

`number` = `30_000`

#### Returns

`Promise`\<\{ `claimed`: `true`; `reclaimed?`: `boolean`; \} \| \{ `claimed`: `false`; `entry?`: [`ReplayEntry`](../type-aliases/ReplayEntry.md); \}\>

#### Implementation of

[`ReplayLedger`](../interfaces/ReplayLedger.md).[`claim`](../interfaces/ReplayLedger.md#claim)

***

### complete()

> **complete**(`messageId`, `outcome`): `Promise`\<`void`\>

Mark a claimed message as durably processed with its outcome.

#### Parameters

##### messageId

`string`

##### outcome

[`ReplayOutcome`](../interfaces/ReplayOutcome.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ReplayLedger`](../interfaces/ReplayLedger.md).[`complete`](../interfaces/ReplayLedger.md#complete)

***

### get()

> **get**(`messageId`): `Promise`\<[`ReplayEntry`](../type-aliases/ReplayEntry.md) \| `undefined`\>

Look up a previously processed message.

#### Parameters

##### messageId

`string`

#### Returns

`Promise`\<[`ReplayEntry`](../type-aliases/ReplayEntry.md) \| `undefined`\>

#### Implementation of

[`ReplayLedger`](../interfaces/ReplayLedger.md).[`get`](../interfaces/ReplayLedger.md#get)
