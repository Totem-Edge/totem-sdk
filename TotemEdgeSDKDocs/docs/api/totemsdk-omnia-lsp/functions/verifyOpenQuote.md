[**@totemsdk/omnia-lsp**](../index.md)

***

[@totemsdk/omnia-lsp](../index.md) / verifyOpenQuote

# Function: verifyOpenQuote()

> **verifyOpenQuote**(`value`, `manifest`, `options?`): `Promise`\<[`VerifyOpenQuoteResult`](../interfaces/VerifyOpenQuoteResult.md)\>

Verify that a quote is authentic and still applies (OMN-071 / OMN-066).

Checks, in order: structural validity, freshness against the supplied clock,
that the quoted fields reproduce `termsHash`, that the provider identity
matches the manifest and token offering, that the quote is bound to the
expected consumer (when supplied), and the signature over the recomputed
terms hash.

## Parameters

### value

`unknown`

### manifest

[`OmniaLspManifest`](../interfaces/OmniaLspManifest.md)

### options?

[`VerifyOpenQuoteOptions`](../interfaces/VerifyOpenQuoteOptions.md) = `{}`

## Returns

`Promise`\<[`VerifyOpenQuoteResult`](../interfaces/VerifyOpenQuoteResult.md)\>
