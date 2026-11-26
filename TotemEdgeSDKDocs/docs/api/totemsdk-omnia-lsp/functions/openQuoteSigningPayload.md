[**@totemsdk/omnia-lsp**](../index.md)

***

[@totemsdk/omnia-lsp](../index.md) / openQuoteSigningPayload

# Function: openQuoteSigningPayload()

> **openQuoteSigningPayload**(`quote`): [`OpenQuoteSigningPayload`](../interfaces/OpenQuoteSigningPayload.md)

The bytes a provider signs: `domain|termsHash`.

Signing the terms hash (rather than the whole quote object) means a verifier
never has to agree on object key order, and any field change invalidates the
signature as soon as the hash is recomputed.

## Parameters

### quote

`Pick`\<[`OmniaLspOpenQuote`](../interfaces/OmniaLspOpenQuote.md), `"termsHash"`\>

## Returns

[`OpenQuoteSigningPayload`](../interfaces/OpenQuoteSigningPayload.md)
