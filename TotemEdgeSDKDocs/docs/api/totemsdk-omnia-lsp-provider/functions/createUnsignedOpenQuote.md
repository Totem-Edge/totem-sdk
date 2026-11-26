[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / createUnsignedOpenQuote

# Function: createUnsignedOpenQuote()

> **createUnsignedOpenQuote**(`options`): [`UnsignedOmniaLspOpenQuote`](../type-aliases/UnsignedOmniaLspOpenQuote.md)

Build the provider's unsigned open quote. The provider host signs it before
returning it to the consumer; a quote without a signature is not authoritative.

The quoted fees come from the shared schedule (OMN-072) and the terms object
is built by `buildOpenTerms`, which is the same function the verifier uses to
recompute the hash.

## Parameters

### options

[`CreateQuoteOptions`](../interfaces/CreateQuoteOptions.md)

## Returns

[`UnsignedOmniaLspOpenQuote`](../type-aliases/UnsignedOmniaLspOpenQuote.md)
