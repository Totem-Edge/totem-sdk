[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / setSigningJournal

# Function: setSigningJournal()

> **setSigningJournal**(`journal?`): `void`

Install the journal used by `beginSigningAttempt`. Hosts call this once at
start-up with a durable implementation; omit it to keep the in-memory
default.

## Parameters

### journal?

[`SigningIntentJournal`](../interfaces/SigningIntentJournal.md)

## Returns

`void`
