[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / canonicalChallenge

# Function: canonicalChallenge()

> **canonicalChallenge**(`challenge`): `string`

Canonical serialization of a WorkChallenge.

Deterministic field ordering with length-prefixed strings so that no
ambiguous concatenation is possible. Used for the commitment and for
challenge fingerprints.

## Parameters

### challenge

[`WorkChallenge`](../interfaces/WorkChallenge.md)

## Returns

`string`
