[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / acceptResponse

# Function: acceptResponse()

> **acceptResponse**(`session`, `response`, `options?`): [`SigningSession`](../interfaces/SigningSession.md)

Accept a signing response into the session.

RFC-018 P1-2: the response is bound to the session (`requestId`), its role
must be part of the session, one signer may not fill several roles, and —
when `roleKeys` is supplied — the signature is verified against the
authorized key for that role. Invalid responses throw rather than silently
advancing the session.

## Parameters

### session

[`SigningSession`](../interfaces/SigningSession.md)

### response

[`PolicySigningResponse`](../interfaces/PolicySigningResponse.md)

### options?

[`AcceptResponseOptions`](../interfaces/AcceptResponseOptions.md) = `{}`

## Returns

[`SigningSession`](../interfaces/SigningSession.md)
