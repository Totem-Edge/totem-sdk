[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / toEnhancedBuildParams

# Function: toEnhancedBuildParams()

> **toEnhancedBuildParams**(`draft`): `EnhancedBuildParams`

Convert an `OmniaTxDraft` to `@totemsdk/tx-builder`'s `EnhancedBuildParams`.

This is the bridge between the Omnia state-machine draft format and the
canonical Minima TX representation used by the tx-builder. Amounts are
converted from `bigint` to decimal string as required by `EnhancedCoinInput`
and `EnhancedCoinOutput`.

To produce real Minima binary TX bytes, pass the returned `EnhancedBuildParams`
to `@totemsdk/core`'s `serializeTransaction()`, then use `buildTxPoWPayload()`
to wrap the result in a TxPoW body for mining and broadcast.

## Parameters

### draft

[`OmniaTxDraft`](../interfaces/OmniaTxDraft.md)

## Returns

`EnhancedBuildParams`
