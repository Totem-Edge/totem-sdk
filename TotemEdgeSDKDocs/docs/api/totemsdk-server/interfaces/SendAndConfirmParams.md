[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / SendAndConfirmParams

# Interface: SendAndConfirmParams

Parameters for `sendTransaction()`.

## Extends

- [`SendParams`](SendParams.md).`Omit`\<[`ConfirmParams`](ConfirmParams.md), `"txpowId"` \| `"expect"`\>

## Properties

### addressIndex

> **addressIndex**: `number`

Account index (0–63) — determines which per-address TreeKey is used.
Must match the address that owns the coins to be spent.

#### Inherited from

[`SendParams`](SendParams.md).[`addressIndex`](SendParams.md#addressindex)

***

### amount

> **amount**: `string`

Amount to send as a decimal string, e.g. `"10"` or `"0.5"`.

#### Inherited from

[`SendParams`](SendParams.md).[`amount`](SendParams.md#amount)

***

### apiKey

> **apiKey**: `string`

Axia API key (sent as `x-api-key` header).

#### Inherited from

[`SendParams`](SendParams.md).[`apiKey`](SendParams.md#apikey)

***

### assertRecoverable?

> `optional` **assertRecoverable?**: `boolean`

When true, re-read the txpow record after confirmation and fail if the node
no longer serves it (so `confirmed` implies recoverability).

#### Inherited from

[`ConfirmParams`](ConfirmParams.md).[`assertRecoverable`](ConfirmParams.md#assertrecoverable)

***

### axiaBaseUrl

> **axiaBaseUrl**: `string`

Axia API base URL, e.g. `"https://api.axia.to"`.

#### Inherited from

[`SendParams`](SendParams.md).[`axiaBaseUrl`](SendParams.md#axiabaseurl)

***

### chunkSize?

> `optional` **chunkSize?**: `number`

Hash iterations per async yield during mining.
Default: 10 000. Lower = more responsive; higher = slightly faster.

#### Inherited from

[`SendParams`](SendParams.md).[`chunkSize`](SendParams.md#chunksize)

***

### expect?

> `optional` **expect?**: [`ConfirmExpectation`](ConfirmExpectation.md)

Defaults to `{ toAddress, tokenId, minIncrease: amount }` from the send.

***

### intervalMs?

> `optional` **intervalMs?**: `number`

Poll interval in ms (default 3000).

#### Inherited from

[`ConfirmParams`](ConfirmParams.md).[`intervalMs`](ConfirmParams.md#intervalms)

***

### provider

> **provider**: [`ConfirmationProvider`](ConfirmationProvider.md)

#### Inherited from

[`ConfirmParams`](ConfirmParams.md).[`provider`](ConfirmParams.md#provider)

***

### seed

> **seed**: `string`

24-word Minima seed phrase.
Store securely — never log or expose this value.

#### Inherited from

[`SendParams`](SendParams.md).[`seed`](SendParams.md#seed)

***

### signal?

> `optional` **signal?**: `AbortSignal`

Optional AbortSignal to cancel mining.

#### Inherited from

[`SendParams`](SendParams.md).[`signal`](SendParams.md#signal)

***

### signingIndices

> **signingIndices**: `object`

WOTS one-time signing indices. Must be unique per transaction.
l1 ∈ [0, 63], l2 ∈ [0, 63].

#### l1

> **l1**: `number`

#### l2

> **l2**: `number`

#### Inherited from

[`SendParams`](SendParams.md).[`signingIndices`](SendParams.md#signingindices)

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Overall timeout in ms (default 120000).

#### Inherited from

[`ConfirmParams`](ConfirmParams.md).[`timeoutMs`](ConfirmParams.md#timeoutms)

***

### toAddress

> **toAddress**: `string`

Recipient address — Mx-prefix or hex (with or without `0x`).

#### Inherited from

[`SendParams`](SendParams.md).[`toAddress`](SendParams.md#toaddress)

***

### tokenId?

> `optional` **tokenId?**: `string`

Token ID. Defaults to `"0x00"` (native MIN).

#### Inherited from

[`SendParams`](SendParams.md).[`tokenId`](SendParams.md#tokenid)
