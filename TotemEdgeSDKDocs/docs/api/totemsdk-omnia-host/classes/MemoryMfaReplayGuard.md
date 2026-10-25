[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / MemoryMfaReplayGuard

# Class: MemoryMfaReplayGuard

Single-use replay guard (durable in a hosted deployment).

## Implements

- [`MfaReplayGuard`](../interfaces/MfaReplayGuard.md)

## Constructors

### Constructor

> **new MemoryMfaReplayGuard**(): `MemoryMfaReplayGuard`

#### Returns

`MemoryMfaReplayGuard`

## Methods

### add()

> **add**(`challengeId`): `void`

#### Parameters

##### challengeId

`string`

#### Returns

`void`

#### Implementation of

[`MfaReplayGuard`](../interfaces/MfaReplayGuard.md).[`add`](../interfaces/MfaReplayGuard.md#add)

***

### has()

> **has**(`challengeId`): `boolean`

#### Parameters

##### challengeId

`string`

#### Returns

`boolean`

#### Implementation of

[`MfaReplayGuard`](../interfaces/MfaReplayGuard.md).[`has`](../interfaces/MfaReplayGuard.md#has)
