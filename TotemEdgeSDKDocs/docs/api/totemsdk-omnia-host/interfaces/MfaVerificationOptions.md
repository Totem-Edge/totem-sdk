[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / MfaVerificationOptions

# Interface: MfaVerificationOptions

## Properties

### clockSkewMs?

> `optional` **clockSkewMs?**: `number`

Tolerated future clock skew for issuedAt (default 5 minutes).

***

### digits?

> `optional` **digits?**: `number`

***

### disclosureId?

> `optional` **disclosureId?**: `string`

***

### now?

> `optional` **now?**: `number`

***

### operationHash

> **operationHash**: `string`

Expected operation hash (see `mfaOperationHash`).

***

### period?

> `optional` **period?**: `number`

***

### secret

> **secret**: `string` \| `Uint8Array`\<`ArrayBufferLike`\>

***

### used?

> `optional` **used?**: [`MfaReplayGuard`](MfaReplayGuard.md)

Replay guard; defaults to a process-local guard when omitted.

***

### window?

> `optional` **window?**: `number`
