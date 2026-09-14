[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / createOutboxDrainer

# Function: createOutboxDrainer()

> **createOutboxDrainer**(`opts`): `object`

Create a bounded outbox drain worker.

Returns:
  - `drain()`: attempt all undelivered messages (one pass, bounded attempts).
  - `start()`/`stop()`: a simple interval loop (caller controls cadence).
  - `resume()`: drain undelivered on restart.

## Parameters

### opts

[`OutboxDrainerOptions`](../interfaces/OutboxDrainerOptions.md)

## Returns

`object`

### drain

> **drain**: () => `Promise`\<\{ `delivered`: `number`; `held`: `number`; `retrying`: `number`; \}\>

#### Returns

`Promise`\<\{ `delivered`: `number`; `held`: `number`; `retrying`: `number`; \}\>

### resume

> **resume**: () => `Promise`\<\{ `delivered`: `number`; `held`: `number`; `retrying`: `number`; \}\> = `drain`

#### Returns

`Promise`\<\{ `delivered`: `number`; `held`: `number`; `retrying`: `number`; \}\>

### start

> **start**: (`intervalMs`) => `void`

#### Parameters

##### intervalMs?

`number` = `5_000`

#### Returns

`void`

### stop

> **stop**: () => `void`

#### Returns

`void`
