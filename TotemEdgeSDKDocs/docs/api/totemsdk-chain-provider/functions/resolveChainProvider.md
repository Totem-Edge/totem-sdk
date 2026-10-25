[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / resolveChainProvider

# Function: resolveChainProvider()

> **resolveChainProvider**(`config`, `options`): [`ChainStateProvider`](../interfaces/ChainStateProvider.md)

Resolve a [ChainStateProvider](../interfaces/ChainStateProvider.md) from the persisted config.

- `axia` → the hosted relay (default).
- `minima-rpc` → the user's own node.
- `composite` → node first, hosted fallback (unless `fallbackToAxia === false`).

## Parameters

### config

[`ChainProviderConfig`](../interfaces/ChainProviderConfig.md)

### options

[`ResolveChainProviderOptions`](../interfaces/ResolveChainProviderOptions.md)

## Returns

[`ChainStateProvider`](../interfaces/ChainStateProvider.md)
