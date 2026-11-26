[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / signOpenQuote

# Function: signOpenQuote()

> **signOpenQuote**(`quote`, `sign`): `Promise`\<`OmniaLspOpenQuote`\>

Sign an unsigned quote with a provider identity signer. The signer is injected
so the package stays runtime-neutral and never holds a private key.

The second argument is the exact payload to sign (`domain|termsHash`). A
one-argument signer keeps working; a signer that ignores the payload must sign
this same string to produce quotes that `verifyOpenQuote` accepts.

## Parameters

### quote

[`UnsignedOmniaLspOpenQuote`](../type-aliases/UnsignedOmniaLspOpenQuote.md)

### sign

(`quote`, `payload`) => `string` \| `Promise`\<`string`\>

## Returns

`Promise`\<`OmniaLspOpenQuote`\>
