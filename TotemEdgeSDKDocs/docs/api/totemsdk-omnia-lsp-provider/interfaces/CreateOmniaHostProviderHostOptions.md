[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / CreateOmniaHostProviderHostOptions

# Interface: CreateOmniaHostProviderHostOptions

## Properties

### closeMethod?

> `optional` **closeMethod?**: `string`

***

### methods

> **methods**: [`OmniaHostMethodMap`](OmniaHostMethodMap.md) \| `Map`\<`string`, [`OmniaHostHandler`](../type-aliases/OmniaHostHandler.md)\>

`createHostMethods(context)` map (or any Map-like handler registry).

***

### openMethod?

> `optional` **openMethod?**: `string`

***

### operationIdPrefix?

> `optional` **operationIdPrefix?**: `string`

Optional operation id prefix. Default: omnia-lsp.
