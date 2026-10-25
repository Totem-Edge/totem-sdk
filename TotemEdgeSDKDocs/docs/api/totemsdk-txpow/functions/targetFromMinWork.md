[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / targetFromMinWork

# Function: targetFromMinWork()

> **targetFromMinWork**(`minWorkHex`): `Uint8Array`

Convert a live `currentmintxpowwork` value (32-byte hex target) into a mining
target, applying the same 10% margin the node's own wallet uses
(`minwork * 10 / 11`, see Java `TxPoWGenerator.generateTxPoW`).

`TxPoWChecker.checkTxPoWSimple` rejects only when
`txnDifficulty > magic.getMinTxPowWork()`, so a target that is harder than
the live minimum is always accepted; the margin absorbs the tiny per-block
Magic retarget.

## Parameters

### minWorkHex

`string`

## Returns

`Uint8Array`
