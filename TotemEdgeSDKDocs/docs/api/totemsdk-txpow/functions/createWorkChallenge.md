[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / createWorkChallenge

# Function: createWorkChallenge()

> **createWorkChallenge**(`recipient`, `domain`, `target`, `options?`): [`WorkChallenge`](../interfaces/WorkChallenge.md)

Create a WorkChallenge.

## Parameters

### recipient

`string`

The intended receiver the challenge binds to.

### domain

`string`

Application domain (open-ended, e.g. "totem.compute.reserve").

### target

`string`

Absolute 32-byte cryptographic target (hex).

### options?

Optional overrides (challengeId, nonce, ttl, issuedAt, network).

#### challengeId?

`string`

#### issuedAt?

`number`

#### network?

`string`

#### nonce?

`string`

#### ttlMs?

`number`

## Returns

[`WorkChallenge`](../interfaces/WorkChallenge.md)
