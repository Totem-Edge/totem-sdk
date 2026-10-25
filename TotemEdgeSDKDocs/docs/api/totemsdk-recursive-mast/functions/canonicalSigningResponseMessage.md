[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / canonicalSigningResponseMessage

# Function: canonicalSigningResponseMessage()

> **canonicalSigningResponseMessage**(`session`, `response`): `Uint8Array`

RFC-018 P1-2: the canonical bytes a signer signs for a session response.
Excludes `signature` itself; binds the response to the session, action,
epoch and transaction digest.

## Parameters

### session

[`SigningSession`](../interfaces/SigningSession.md)

### response

[`PolicySigningResponse`](../interfaces/PolicySigningResponse.md)

## Returns

`Uint8Array`
