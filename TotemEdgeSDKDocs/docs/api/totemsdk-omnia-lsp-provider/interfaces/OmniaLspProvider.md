[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / OmniaLspProvider

# Interface: OmniaLspProvider

## Methods

### close()

> **close**(`channelId`): `Promise`\<[`OmniaLspHostCloseResult`](OmniaLspHostCloseResult.md)\>

#### Parameters

##### channelId

`string`

#### Returns

`Promise`\<[`OmniaLspHostCloseResult`](OmniaLspHostCloseResult.md)\>

***

### evaluate()

> **evaluate**(`request`): [`OmniaLspOpenDecision`](OmniaLspOpenDecision.md)

#### Parameters

##### request

[`OmniaLspOpenRequest`](OmniaLspOpenRequest.md)

#### Returns

[`OmniaLspOpenDecision`](OmniaLspOpenDecision.md)

***

### manifest()

> **manifest**(): `OmniaLspManifest`

#### Returns

`OmniaLspManifest`

***

### open()

> **open**(`request`, `funding?`): `Promise`\<[`OmniaLspHostOpenResult`](OmniaLspHostOpenResult.md)\>

#### Parameters

##### request

[`OmniaLspOpenRequest`](OmniaLspOpenRequest.md)

##### funding?

`string` \| `OmniaLspHostFunding`

#### Returns

`Promise`\<[`OmniaLspHostOpenResult`](OmniaLspHostOpenResult.md)\>

***

### openQuote()

> **openQuote**(`quote`, `funding?`, `options?`): `Promise`\<[`OmniaLspHostOpenResult`](OmniaLspHostOpenResult.md)\>

#### Parameters

##### quote

`OmniaLspOpenQuote`

##### funding?

`string` \| `OmniaLspHostFunding`

##### options?

[`OmniaLspOpenQuoteOptions`](OmniaLspOpenQuoteOptions.md)

#### Returns

`Promise`\<[`OmniaLspHostOpenResult`](OmniaLspHostOpenResult.md)\>

***

### quote()

> **quote**(`request`): `Promise`\<`OmniaLspOpenQuote`\>

#### Parameters

##### request

[`OmniaLspOpenRequest`](OmniaLspOpenRequest.md)

#### Returns

`Promise`\<`OmniaLspOpenQuote`\>
