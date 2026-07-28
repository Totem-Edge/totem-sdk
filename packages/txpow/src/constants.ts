/**
 * constants.ts — TxPoW-level constants matching Minima Java protocol values.
 *
 * ZERO_HASH:              32-byte all-zeros — used for MMRRoot, CustomHash, super-parent slot.
 * MAX_HASH:               32-byte all-0xFF — default mBlockDifficulty / mTxnDifficulty for
 *                         MEG-side-mined paths. Rejected by checkTxPoWSimple() at block level.
 * TX_POW_MIN_DIFFICULTY:  Safe transaction difficulty target.
 *                         ≈ MAX_HASH / 1,000,000 = Magic.getMinTxPowWork() floor.
 *                         Local-mining paths MUST use a target ≤ this value.
 * MAIN_NET_CHAIN_ID:      1-byte [0x00] — Java MiniData("0x00") = MAIN_NET chain ID.
 * CASCADE_LEVELS:         32 — number of super-parent slots in a fresh TxPoW header.
 */

export const CASCADE_LEVELS = 32;

export const ZERO_HASH = new Uint8Array(32);

export const MAX_HASH: Uint8Array = (() => {
  const b = new Uint8Array(32);
  b.fill(0xff);
  return b;
})();

/**
 * TX_POW_MIN_DIFFICULTY = floor((2^256 - 1) / 1_000_000)
 *
 * This is the hardcoded floor constant matching Magic.getMinTxPowWork().
 * Any locally mined TxPoW must have mTxnDifficulty ≤ this value to pass
 * TxPoWChecker.checkTxPoWSimple() at block inclusion.
 *
 * Computed: (2n**256n - 1n) / 1_000_000n
 * Hex: 0x000010C6F7A0B5ED8538AACDD46595F0C7AC73E0E9DBF12F70000000000000000
 */
export const TX_POW_MIN_DIFFICULTY: Uint8Array = (() => {
  const maxHashBigInt = (2n ** 256n) - 1n;
  const minDiffBigInt = maxHashBigInt / 1_000_000n;

  let hex = minDiffBigInt.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  while (hex.length < 64) hex = '00' + hex;

  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
})();

export const MAIN_NET_CHAIN_ID = new Uint8Array([0x00]);
