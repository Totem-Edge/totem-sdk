[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / OmniaLspProviderConfig

# Interface: OmniaLspProviderConfig

## Properties

### host

> **host**: [`OmniaLspProviderHost`](OmniaLspProviderHost.md)

***

### manifest

> **manifest**: `OmniaLspManifest`

***

### now?

> `optional` **now?**: () => `number`

Clock injection for deterministic tests. The provider clock is authoritative.

#### Returns

`number`

***

### policy?

> `optional` **policy?**: [`OmniaLspProviderPolicy`](OmniaLspProviderPolicy.md)

***

### quoteLedger?

> `optional` **quoteLedger?**: [`OmniaLspQuoteLedger`](OmniaLspQuoteLedger.md)

Durable reservation ledger (OMN-068). Defaults to an in-process ledger,
which enforces concurrency limits but does not survive a restart.

***

### quoteTtlMs?

> `optional` **quoteTtlMs?**: `number`

Default quote TTL. Default 60s.

***

### requireConsumerBinding?

> `optional` **requireConsumerBinding?**: `boolean`

Require `openQuote` to be given the authenticated consumer so the quote can
be bound to it. Default true — pass false only for a caller that has
already authenticated the quote's consumer outside this facade.

***

### signQuote

> **signQuote**: (`quote`, `payload`) => `string` \| `Promise`\<`string`\>

Provider identity signer for quotes. Required for quote issuance.

#### Parameters

##### quote

[`UnsignedOmniaLspOpenQuote`](../type-aliases/UnsignedOmniaLspOpenQuote.md)

##### payload

`OpenQuoteSigningPayload`

#### Returns

`string` \| `Promise`\<`string`\>

***

### verifyQuoteSignature?

> `optional` **verifyQuoteSignature?**: (`input`) => `boolean` \| `Promise`\<`boolean`\>

Verify a provider quote signature over `domain|termsHash` (OMN-066).
Required to redeem a quote with `openQuote`; when absent, redemption fails
closed rather than trusting an unverified quote.

#### Parameters

##### input

`OpenQuoteSigningPayload` & `object`

#### Returns

`boolean` \| `Promise`\<`boolean`\>
