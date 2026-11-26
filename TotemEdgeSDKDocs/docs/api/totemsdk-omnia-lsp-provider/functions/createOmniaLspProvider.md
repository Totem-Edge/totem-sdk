[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / createOmniaLspProvider

# Function: createOmniaLspProvider()

> **createOmniaLspProvider**(`config`): [`OmniaLspProvider`](../interfaces/OmniaLspProvider.md)

Reference provider facade.

It does not hold keys, open channels or broadcast. It applies policy, issues
signed quotes, reserves provider capacity and delegates the channel operation
to the injected host.

## Parameters

### config

[`OmniaLspProviderConfig`](../interfaces/OmniaLspProviderConfig.md)

## Returns

[`OmniaLspProvider`](../interfaces/OmniaLspProvider.md)
