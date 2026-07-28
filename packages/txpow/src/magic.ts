/**
 * magic.ts — Serialize the Minima Magic struct.
 *
 * Ported from the extension's MinimaTransactionBuilder.ts::serializeMagic().
 * Matches Magic.writeDataStream() in Java exactly.
 *
 * Magic contains two copies of 4 fields (current + desired parameters):
 *   maxTxPoWSize  (MiniNumber)
 *   maxKISSVMOps  (MiniNumber)
 *   maxTxnPerBlock(MiniNumber)
 *   minTxPoWWork  (MiniData — 32 bytes)
 *
 * Default values from Magic.java:
 *   maxTxPoWSize  = 65536
 *   maxKISSVMOps  = 1024
 *   maxTxnPerBlock = 256
 *   minTxPoWWork  = MAX_HASH (all 0xFF, 32 bytes) — placeholder in fresh TxPoW
 */

import { writeMiniNumber, writeMiniData, concat } from '@totemsdk/core';
import { MAX_HASH } from './constants.js';

export function serializeMagic(): Uint8Array {
  const parts: Uint8Array[] = [];

  parts.push(writeMiniNumber(65536n));
  parts.push(writeMiniNumber(1024n));
  parts.push(writeMiniNumber(256n));
  parts.push(writeMiniData(MAX_HASH));

  parts.push(writeMiniNumber(65536n));
  parts.push(writeMiniNumber(1024n));
  parts.push(writeMiniNumber(256n));
  parts.push(writeMiniData(MAX_HASH));

  return concat(...parts);
}
