[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / ConfirmParams

# Interface: ConfirmParams

## Properties

### assertRecoverable?

> `optional` **assertRecoverable?**: `boolean`

When true, re-read the txpow record after confirmation and fail if the node
no longer serves it (so `confirmed` implies recoverability).

***

### expect?

> `optional` **expect?**: [`ConfirmExpectation`](ConfirmExpectation.md)

Optional recipient balance-delta assertion.

***

### intervalMs?

> `optional` **intervalMs?**: `number`

Poll interval in ms (default 3000).

***

### provider

> **provider**: [`ConfirmationProvider`](ConfirmationProvider.md)

***

### signal?

> `optional` **signal?**: `AbortSignal`

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Overall timeout in ms (default 120000).

***

### txpowId

> **txpowId**: `string`
