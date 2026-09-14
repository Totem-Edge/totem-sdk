[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / buildEmptyBurnTxBytes

# Function: buildEmptyBurnTxBytes()

> **buildEmptyBurnTxBytes**(): `Uint8Array`

Build the empty burn transaction bytes (TxBody.writeDataStream fields 5-6).

Equivalent to serializeTransaction({ linkHash: [0x00], inputs: [], outputs: [],
state: [] }): 0 inputs, 0 outputs, 0 state, linkHash = ZERO_TXPOWID (1 byte).

## Returns

`Uint8Array`
