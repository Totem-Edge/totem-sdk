[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / MegaMMRConfig

# Interface: MegaMMRConfig

MegaMMR / indexer mode configuration.

When enabled:
  - GET_COINS requests without an `address` filter are accepted (chain-wide indexer).
  - The provider is expected to implement full UTXO index queries
    (e.g. PureMinimaRpcProvider connected to a MegaMMR-enabled node).
  - Standard nodes reject unfiltered GET_COINS requests to prevent unbounded scans.

## Properties

### enabled

> **enabled**: `true`
