[**@totemsdk/omnia-lsp**](../index.md)

***

[@totemsdk/omnia-lsp](../index.md) / rankProviders

# Function: rankProviders()

> **rankProviders**(`candidates`, `request`, `policy?`): [`OmniaLspRankedProvider`](../interfaces/OmniaLspRankedProvider.md)[]

Rank providers deterministically for a request.

This is a policy filter plus a stable sort. It does not verify manifests or
reserve capacity; callers MUST verify the manifest signature, identity
binding and freshness before ranking, and MUST treat capacity as a hint.

## Parameters

### candidates

readonly [`OmniaLspCandidate`](../interfaces/OmniaLspCandidate.md)[]

### request

[`OmniaLspRankingRequest`](../interfaces/OmniaLspRankingRequest.md)

### policy?

[`OmniaLspRankingPolicy`](../interfaces/OmniaLspRankingPolicy.md) = `{}`

## Returns

[`OmniaLspRankedProvider`](../interfaces/OmniaLspRankedProvider.md)[]
