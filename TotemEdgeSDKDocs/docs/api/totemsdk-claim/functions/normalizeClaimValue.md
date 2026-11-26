[**@totemsdk/claim**](../index.md)

***

[@totemsdk/claim](../index.md) / normalizeClaimValue

# Function: normalizeClaimValue()

> **normalizeClaimValue**(`value`): `unknown`

Normalise a value for canonical serialization.

`canonicalJson` sorts object keys but does not handle `bigint`; policies may
carry bigint totals. Bigints become decimal strings, which is the same
representation used on the wire.

## Parameters

### value

`unknown`

## Returns

`unknown`
