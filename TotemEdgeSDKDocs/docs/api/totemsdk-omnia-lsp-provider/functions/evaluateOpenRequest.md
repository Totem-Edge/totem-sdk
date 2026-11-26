[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / evaluateOpenRequest

# Function: evaluateOpenRequest()

> **evaluateOpenRequest**(`manifest`, `request`, `policy?`, `now?`): [`OmniaLspOpenDecision`](../interfaces/OmniaLspOpenDecision.md)

Evaluate an open request against a provider manifest.

This is the provider's admission policy. It does not reserve capacity; the
provider MUST do that through the quote ledger (OMN-068).

Both sides of the channel are validated independently (OMN-067): the
consumer's `localAmount` and the provider's own `remoteAmount`, because the
provider is the party that funds the latter. `now` is the provider's trusted
clock — never the requester's (OMN-069).

## Parameters

### manifest

`OmniaLspManifest`

### request

[`OmniaLspOpenRequest`](../interfaces/OmniaLspOpenRequest.md)

### policy?

[`OmniaLspProviderPolicy`](../interfaces/OmniaLspProviderPolicy.md) = `{}`

### now?

`number` = `...`

## Returns

[`OmniaLspOpenDecision`](../interfaces/OmniaLspOpenDecision.md)
