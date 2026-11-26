[**@totemsdk/omnia-lsp**](../index.md)

***

[@totemsdk/omnia-lsp](../index.md) / quoteMatchesManifest

# Function: quoteMatchesManifest()

> **quoteMatchesManifest**(`quote`, `manifest`): `object`

Bind a quote to the provider manifest fields it claims to represent.
A quote is not a substitute for manifest verification; it must be checked
after the manifest signature and identity binding have been verified.

## Parameters

### quote

[`OmniaLspOpenQuote`](../interfaces/OmniaLspOpenQuote.md)

### manifest

[`OmniaLspManifest`](../interfaces/OmniaLspManifest.md)

## Returns

`object`

### errors

> **errors**: `string`[]

### ok

> **ok**: `boolean`
