[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / createOmniaHostProviderHost

# Function: createOmniaHostProviderHost()

> **createOmniaHostProviderHost**(`options`): [`OmniaLspProviderHost`](../interfaces/OmniaLspProviderHost.md)

Adapt an `omnia-host` method registry (`createHostMethods(context)`) to the
LSP provider host port.

The quote is written from the consumer's perspective: `localAmount` is the
consumer side and `remoteAmount` is the provider side. The host is the provider,
so those sides are swapped when calling `totem_omniaOpenChannel`.

## Parameters

### options

[`CreateOmniaHostProviderHostOptions`](../interfaces/CreateOmniaHostProviderHostOptions.md)

## Returns

[`OmniaLspProviderHost`](../interfaces/OmniaLspProviderHost.md)
