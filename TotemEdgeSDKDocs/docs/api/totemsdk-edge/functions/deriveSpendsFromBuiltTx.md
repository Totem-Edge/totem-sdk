[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / deriveSpendsFromBuiltTx

# Function: deriveSpendsFromBuiltTx()

> **deriveSpendsFromBuiltTx**(`tx`): `object`[]

Derive spends from a built transaction's outputs, excluding:
  - change back to the wallet's own addresses;
  - channel-internal outputs back to the channel script.

## Parameters

### tx

[`BuiltTransaction`](../interfaces/BuiltTransaction.md)

## Returns

`object`[]
