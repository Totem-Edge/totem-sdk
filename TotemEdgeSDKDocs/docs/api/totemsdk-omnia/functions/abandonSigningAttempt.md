[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / abandonSigningAttempt

# Function: abandonSigningAttempt()

> **abandonSigningAttempt**(`channelId`, `sequence`, `payloadHash`): `Promise`\<`void`\>

Release an attempt that failed before any signature was produced. Only a
`pending` intent may be abandoned; a sealed attempt stays blocking forever.

## Parameters

### channelId

`string`

### sequence

`number`

### payloadHash

`string`

## Returns

`Promise`\<`void`\>
