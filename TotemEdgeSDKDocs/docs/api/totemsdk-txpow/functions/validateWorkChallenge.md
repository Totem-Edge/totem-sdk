[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / validateWorkChallenge

# Function: validateWorkChallenge()

> **validateWorkChallenge**(`challenge`, `expected?`): `object`

Validate a WorkChallenge at verification time.

Checks structural integrity, expiry, and that the challenge binds to the
expected recipient/domain. Does NOT check the proof hash — that is the
caller's job via verifyWorkAdmission.

## Parameters

### challenge

[`WorkChallenge`](../interfaces/WorkChallenge.md)

### expected?

#### domain?

`string`

#### now?

`number`

#### recipient?

`string`

## Returns

`object`

### reason?

> `optional` **reason?**: `string`

### valid

> **valid**: `boolean`
