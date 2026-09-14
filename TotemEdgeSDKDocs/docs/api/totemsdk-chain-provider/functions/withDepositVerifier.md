[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / withDepositVerifier

# Function: withDepositVerifier()

> **withDepositVerifier**(`provider`): [`ChainStateProvider`](../interfaces/ChainStateProvider.md) & [`DepositVerifier`](../interfaces/DepositVerifier.md)

Default `DepositVerifier` over any `ChainStateProvider`. The live path uses
`getCoin`; the MMR-root path returns `null` unless the base provider knows a
root (concrete providers override `getMmrRoot`).

## Parameters

### provider

[`ChainStateProvider`](../interfaces/ChainStateProvider.md)

## Returns

[`ChainStateProvider`](../interfaces/ChainStateProvider.md) & [`DepositVerifier`](../interfaces/DepositVerifier.md)
