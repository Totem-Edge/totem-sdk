[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / SendParams

# Interface: SendParams

Parameters for `sendTransaction()`.

## Properties

### addressIndex

> **addressIndex**: `number`

Account index (0–63) — determines which per-address TreeKey is used.
Must match the address that owns the coins to be spent.

***

### amount

> **amount**: `string`

Amount to send as a decimal string, e.g. `"10"` or `"0.5"`.

***

### apiKey

> **apiKey**: `string`

Axia API key (sent as `x-api-key` header).

***

### axiaBaseUrl

> **axiaBaseUrl**: `string`

Axia API base URL, e.g. `"https://api.axia.to"`.

***

### chunkSize?

> `optional` **chunkSize?**: `number`

Hash iterations per async yield during mining.
Default: 10 000. Lower = more responsive; higher = slightly faster.

***

### seed

> **seed**: `string`

24-word Minima seed phrase.
Store securely — never log or expose this value.

***

### signal?

> `optional` **signal?**: `AbortSignal`

Optional AbortSignal to cancel mining.

***

### signingIndices

> **signingIndices**: `object`

WOTS one-time signing indices. Must be unique per transaction.
l1 ∈ [0, 63], l2 ∈ [0, 63].

#### l1

> **l1**: `number`

#### l2

> **l2**: `number`

***

### toAddress

> **toAddress**: `string`

Recipient address — Mx-prefix or hex (with or without `0x`).

***

### tokenId?

> `optional` **tokenId?**: `string`

Token ID. Defaults to `"0x00"` (native MIN).
