[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / OmniaLspProviderPolicy

# Interface: OmniaLspProviderPolicy

## Properties

### availableProviderFunds?

> `optional` **availableProviderFunds?**: `string`

Spendable provider funds for the requested asset, decimal units. When set,
the provider-side contribution must fit inside it (OMN-067).

***

### minProviderScore?

> `optional` **minProviderScore?**: `number`

Minimum provider-bond score accepted by this provider. Informational only.

***

### requireNonCustodial?

> `optional` **requireNonCustodial?**: `boolean`

Reject hosted-custody manifests. Default true for a non-custodial LSP.
