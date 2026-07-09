[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / CASCADE\_LEVELS

# Variable: CASCADE\_LEVELS

> `const` **CASCADE\_LEVELS**: `32` = `32`

constants.ts — TxPoW-level constants matching Minima Java protocol values.

ZERO_HASH:              32-byte all-zeros — used for MMRRoot, CustomHash, super-parent slot.
MAX_HASH:               32-byte all-0xFF — default mBlockDifficulty / mTxnDifficulty for
                        MEG-side-mined paths. Rejected by checkTxPoWSimple() at block level.
TX_POW_MIN_DIFFICULTY:  Safe transaction difficulty target.
                        ≈ MAX_HASH / 1,000,000 = Magic.getMinTxPowWork() floor.
                        Local-mining paths MUST use a target ≤ this value.
MAIN_NET_CHAIN_ID:      1-byte [0x00] — Java MiniData("0x00") = MAIN_NET chain ID.
CASCADE_LEVELS:         32 — number of super-parent slots in a fresh TxPoW header.
