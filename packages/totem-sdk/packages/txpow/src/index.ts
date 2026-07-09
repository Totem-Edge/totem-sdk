/**
 * @totemsdk/txpow
 *
 * TxPoW envelope serialization and proof-of-work mining for the Minima protocol.
 *
 * USAGE — MEG-side mining (byte-identical to extension current behaviour):
 *   const txpow = serializeTxPoW(txBytes, witnessBytes);
 *   // Submit to Axia: node re-mines with correct difficulty
 *
 * USAGE — Local mining:
 *   const target  = await fetchTxPowTarget(axiaBaseUrl);
 *   const txBody  = serializeTxBody(txBytes, witnessBytes, { txnDifficulty: target });
 *   const result  = await mineTxPoW(txBody, target);
 *   const txpow   = concat(result.minedHeaderBytes, new Uint8Array([0x01]), txBody);
 *
 * USAGE — Verify (relay nodes):
 *   const check = verifyProofOfWork(txpowId, mTxnDifficulty);
 *   if (!check.valid) drop(check.reason);
 */

export {
  serializeTxHeader,
  serializeTxBody,
  serializeTxPoW,
  computeTxPoWId,
  type TxHeaderOptions,
  type TxBodyOptions,
  type TxPoWOptions,
} from './serialization.js';

export {
  MAX_HASH,
  ZERO_HASH,
  TX_POW_MIN_DIFFICULTY,
  CASCADE_LEVELS,
  MAIN_NET_CHAIN_ID,
} from './constants.js';

export { serializeMagic } from './magic.js';

export {
  mineTxPoW,
  mineTxPoWInProcess,
  isLessThan,
  setBrowserWorkerUrl,
  type MineResult,
  type MineOptions,
} from './mine.js';

export { setWasmUrl, getBrowserWasmUrl, isWasmAvailable } from './mine-wasm.js';

export { fetchTxPowTarget, type TxPowParams } from './difficulty.js';

export { verifyProofOfWork, verifyTxPoWWork, verifyTxPoWParts, type VerifyResult } from './verify.js';

export {
  calibrateHashRate,
  estimateMiningCost,
  type MiningEstimate,
} from './calibrate.js';
