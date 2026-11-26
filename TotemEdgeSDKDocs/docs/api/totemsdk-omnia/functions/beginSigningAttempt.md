[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / beginSigningAttempt

# Function: beginSigningAttempt()

> **beginSigningAttempt**(`intent`): `Promise`\<`void`\>

Record the intent to sign `(channelId, sequence, payloadHash)` before any
WOTS signature exists. Throws `DoubleSignError` when another payload was
already signed — or may still have been signed — at that sequence.

## Parameters

### intent

#### channelId

`string`

#### payloadHash

`string`

#### purpose

`string`

#### reservationIds?

`string`[]

#### sequence

`number`

## Returns

`Promise`\<`void`\>
