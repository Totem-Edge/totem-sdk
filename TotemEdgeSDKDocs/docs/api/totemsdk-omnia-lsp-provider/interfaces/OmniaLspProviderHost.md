[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / OmniaLspProviderHost

# Interface: OmniaLspProviderHost

Host port implemented by the provider runtime (for example an `omnia-host`
wrapper). The LSP package owns policy and quotes; the host owns channel
construction, signing and broadcast.

## Methods

### closeChannel()?

> `optional` **closeChannel**(`channelId`): `Promise`\<[`OmniaLspHostCloseResult`](OmniaLspHostCloseResult.md)\>

#### Parameters

##### channelId

`string`

#### Returns

`Promise`\<[`OmniaLspHostCloseResult`](OmniaLspHostCloseResult.md)\>

***

### openChannel()

> **openChannel**(`input`): `Promise`\<[`OmniaLspHostOpenResult`](OmniaLspHostOpenResult.md)\>

#### Parameters

##### input

[`OmniaLspHostOpenInput`](OmniaLspHostOpenInput.md)

#### Returns

`Promise`\<[`OmniaLspHostOpenResult`](OmniaLspHostOpenResult.md)\>
