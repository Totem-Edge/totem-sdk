[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / confirmSession

# Function: confirmSession()

> **confirmSession**(`session`, `confirmation`): [`SigningSession`](../interfaces/SigningSession.md)

Mark the session as confirmed (transaction mined).
Requires txpowId and confirmed block — a caller cannot declare
a transaction confirmed without evidence. Session must be in
'submitted' status.

## Parameters

### session

[`SigningSession`](../interfaces/SigningSession.md)

### confirmation

#### confirmedBlock

`number`

#### inclusionProof?

`string`

#### txpowId

`string`

## Returns

[`SigningSession`](../interfaces/SigningSession.md)
