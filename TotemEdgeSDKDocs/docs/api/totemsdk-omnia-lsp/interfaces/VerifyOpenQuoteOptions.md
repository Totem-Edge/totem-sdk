[**@totemsdk/omnia-lsp**](../index.md)

***

[@totemsdk/omnia-lsp](../index.md) / VerifyOpenQuoteOptions

# Interface: VerifyOpenQuoteOptions

## Properties

### expectedConsumerAddress?

> `optional` **expectedConsumerAddress?**: `string`

***

### expectedConsumerPartyId?

> `optional` **expectedConsumerPartyId?**: `string`

***

### expectedConsumerPublicKeyDigest?

> `optional` **expectedConsumerPublicKeyDigest?**: `string`

***

### expectedProviderId?

> `optional` **expectedProviderId?**: `string`

***

### expectedTokenId?

> `optional` **expectedTokenId?**: `string`

***

### now?

> `optional` **now?**: `number`

Trusted clock. Defaults to Date.now().

***

### requireSignature?

> `optional` **requireSignature?**: `boolean`

When false, a quote may be verified without a signature check. Default true.

***

### verifySignature?

> `optional` **verifySignature?**: (`input`) => `boolean` \| `Promise`\<`boolean`\>

Verify the signature over `openQuoteSigningPayload(quote).payload`.
Signature schemes are injected so the package stays runtime-neutral.

#### Parameters

##### input

[`OpenQuoteSigningPayload`](OpenQuoteSigningPayload.md) & `object`

#### Returns

`boolean` \| `Promise`\<`boolean`\>
