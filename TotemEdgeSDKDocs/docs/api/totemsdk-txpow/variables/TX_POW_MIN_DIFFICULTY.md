[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / TX\_POW\_MIN\_DIFFICULTY

# Variable: TX\_POW\_MIN\_DIFFICULTY

> `const` **TX\_POW\_MIN\_DIFFICULTY**: `Uint8Array`

TX_POW_MIN_DIFFICULTY = floor((2^256 - 1) / 1_000_000)

This is the hardcoded floor constant matching Magic.getMinTxPowWork().
Any locally mined TxPoW must have mTxnDifficulty ≤ this value to pass
TxPoWChecker.checkTxPoWSimple() at block inclusion.

Computed: (2n**256n - 1n) / 1_000_000n
Hex: 0x000010C6F7A0B5ED8538AACDD46595F0C7AC73E0E9DBF12F70000000000000000
