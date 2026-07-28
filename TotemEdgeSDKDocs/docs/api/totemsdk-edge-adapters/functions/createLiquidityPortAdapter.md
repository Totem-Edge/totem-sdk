[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createLiquidityPortAdapter

# Function: createLiquidityPortAdapter()

> **createLiquidityPortAdapter**(`config`): `EdgeLiquidityPort`

Wraps a ChainStateProvider (chain-provider, pureminima-rpc, lookup-client) as
an EdgeLiquidityPort.

getBalance sums sendable coins for the given address and tokenId.
getUtxos returns all coins as raw UTXOs (typed as unknown[] per the port contract).

## Parameters

### config

[`LiquidityPortConfig`](../interfaces/LiquidityPortConfig.md)

## Returns

`EdgeLiquidityPort`
