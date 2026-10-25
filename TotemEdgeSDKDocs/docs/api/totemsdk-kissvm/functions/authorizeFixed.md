[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / authorizeFixed

# Function: authorizeFixed()

> **authorizeFixed**(`authority`): `string`

I1: authorize against a **fixed** key or a **previously committed** authority
(`PREVSTATE(port)`). Never pass a value read from mutable current `STATE`.

## Parameters

### authority

\{ `key`: `string`; \} \| \{ `prevStatePort`: `number`; \}

## Returns

`string`
