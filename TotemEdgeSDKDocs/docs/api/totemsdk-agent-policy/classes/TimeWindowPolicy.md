[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / TimeWindowPolicy

# Class: TimeWindowPolicy

TimeWindowPolicy — only approves proposals during a configurable
daily time window (e.g. business hours 06:00 – 22:00 UTC).

Times are specified in **minutes since midnight UTC**. Use helpers:
- `TimeWindowPolicy.hour(6)`   → 360   (06:00)
- `TimeWindowPolicy.hour(22)`  → 1320  (22:00)

Proposals outside the window are rejected with the time until the
next opening so the agent can schedule a retry.

## Example

```ts
// Only allow proposals between 06:00 and 22:00 UTC
const businessHours = new TimeWindowPolicy(360, 1320);
```

## Implements

- [`PolicyMiddleware`](../interfaces/PolicyMiddleware.md)

## Constructors

### Constructor

> **new TimeWindowPolicy**(`startMinute`, `endMinute`): `TimeWindowPolicy`

#### Parameters

##### startMinute

`number`

Minutes since midnight UTC when the window opens (0–1439).

##### endMinute

`number`

Minutes since midnight UTC when the window closes (1–1440).

#### Returns

`TimeWindowPolicy`

## Methods

### evaluate()

> **evaluate**(`proposal`, `now?`): `Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

Evaluate a proposal. Called in sequence by ComposablePolicy.

#### Parameters

##### proposal

[`AgentProposal`](../interfaces/AgentProposal.md)

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

#### Implementation of

[`PolicyMiddleware`](../interfaces/PolicyMiddleware.md).[`evaluate`](../interfaces/PolicyMiddleware.md#evaluate)

***

### hour()

> `static` **hour**(`h`): `number`

Convenience: convert an hour (0–23) to minutes since midnight.

#### Parameters

##### h

`number`

#### Returns

`number`
