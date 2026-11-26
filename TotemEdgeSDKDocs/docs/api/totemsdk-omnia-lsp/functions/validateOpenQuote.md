[**@totemsdk/omnia-lsp**](../index.md)

***

[@totemsdk/omnia-lsp](../index.md) / validateOpenQuote

# Function: validateOpenQuote()

> **validateOpenQuote**(`value`, `options?`): [`QuoteValidationResult`](../interfaces/QuoteValidationResult.md)

Structural validation only.

Passing this does not establish that the quote is authentic: it does not
recompute the terms hash or verify the signature. Use `verifyOpenQuote` for
that (OMN-071).

## Parameters

### value

`unknown`

### options?

[`QuoteValidationOptions`](../interfaces/QuoteValidationOptions.md) = `{}`

## Returns

[`QuoteValidationResult`](../interfaces/QuoteValidationResult.md)
