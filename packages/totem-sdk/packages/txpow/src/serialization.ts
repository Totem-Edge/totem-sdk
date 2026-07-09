/**
 * serialization.ts — TxPoW envelope serialization.
 *
 * Ports serializeTxHeader / serializeTxBody / serializeTxPoW from
 * packages/totem-extension/src/core/transaction/MinimaTransactionBuilder.ts
 * into the standalone @totemsdk/txpow package.
 *
 * KEY DESIGN DECISIONS
 * ─────────────────────────────────────────────────────────────────────────
 * • serializeTxBody accepts PRE-SERIALIZED transaction bytes and witness bytes.
 *   Callers use @totemsdk/core's serializeTransaction() + their own witness
 *   serializer, then pass the byte arrays here. This keeps @totemsdk/txpow
 *   free of WotsSignatureData / InputScriptInfo / CoinProof dependencies.
 *
 * • txnDifficulty defaults to MAX_HASH (all 0xFF) to produce byte-identical
 *   output to the extension's current MEG-mined path. For locally mined TxPoWs
 *   the caller MUST pass a value ≤ TX_POW_MIN_DIFFICULTY, otherwise the
 *   transaction will fail TxPoWChecker.checkTxPoWSimple() at block inclusion.
 *
 * • nonce defaults to 0n (the mining loop updates it). timeMilli defaults to
 *   Date.now() at call time.
 *
 * WIRE FORMAT REFERENCE
 * ─────────────────────────────────────────────────────────────────────────
 * TxHeader.writeDataStream():
 *   1. mNonce           MiniNumber
 *   2. mChainID         MiniData   (MAIN_NET = [0x00])
 *   3. mTimeMilli       MiniNumber
 *   4. mBlockNumber     MiniNumber (0 for fresh TxPoW)
 *   5. mBlockDifficulty MiniData   (MAX_HASH for fresh TxPoW)
 *   6. Super Parents    RLE: 1 byte count + writeHashToStream(parent)
 *   7. mMMRRoot         writeHashToStream (ZERO_HASH for fresh TxPoW)
 *   8. mMMRTotal        MiniNumber (0)
 *   9. mMagic           Magic.writeDataStream()
 *  10. mCustomHash      writeHashToStream (ZERO_HASH)
 *  11. mTxBodyHash      writeHashToStream
 *
 * TxBody.writeDataStream():
 *   1. mPRNG            writeHashToStream (32 random bytes)
 *   2. mTxnDifficulty   MiniData
 *   3. mTransaction     Transaction.writeDataStream() (pre-serialized)
 *   4. mWitness         Witness.writeDataStream() (pre-serialized)
 *   5. mBurnTransaction Transaction.writeDataStream() (empty)
 *   6. mBurnWitness     Witness.writeDataStream() (empty)
 *   7. mTxPowIDList     MiniNumber(0)
 *
 * TxPoW.writeDataStream():
 *   TxHeader bytes + MiniByte(0x01=hasBody) + TxBody bytes
 *
 * TxPoW ID:
 *   SHA3-256( TxHeader bytes )  — Java: Crypto.getInstance().hashObject(mHeader)
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import {
  writeMiniNumber,
  writeMiniData,
  concat,
  writeHashToStream,
} from '@totemsdk/core';
import { serializeMagic } from './magic.js';
import {
  MAX_HASH,
  ZERO_HASH,
  CASCADE_LEVELS,
  MAIN_NET_CHAIN_ID,
} from './constants.js';

export interface TxHeaderOptions {
  /** Proof-of-work nonce. Defaults to 0n. The mining loop iterates this. */
  nonce?: bigint;
  /** Block timestamp in milliseconds. Defaults to Date.now() at call time. */
  timeMilli?: bigint;
}

export interface TxBodyOptions {
  /**
   * Transaction difficulty target (32-byte MiniData).
   * • MEG-side-mined path:  leave undefined → MAX_HASH (all 0xFF)
   * • Locally mined path:   MUST be ≤ TX_POW_MIN_DIFFICULTY, typically fetched
   *   via fetchTxPowTarget() from the same package.
   * Setting MAX_HASH for locally mined TxPoWs will cause block-level rejection.
   */
  txnDifficulty?: Uint8Array;
  /** Override the 32-byte PRNG field. Useful for deterministic tests only. */
  prng?: Uint8Array;
}

export type TxPoWOptions = TxHeaderOptions & TxBodyOptions;

/**
 * Serialize a TxHeader per Minima's TxHeader.writeDataStream().
 *
 * @param txBodyHash  SHA3-256 of the serialized TxBody (32 bytes)
 * @param options     Optional nonce and timeMilli overrides
 */
export function serializeTxHeader(
  txBodyHash: Uint8Array,
  options?: TxHeaderOptions
): Uint8Array {
  const nonce = options?.nonce ?? 0n;
  const timeMilli = options?.timeMilli ?? BigInt(Date.now());

  const parts: Uint8Array[] = [];

  parts.push(writeMiniNumber(nonce));
  parts.push(writeMiniData(MAIN_NET_CHAIN_ID));
  parts.push(writeMiniNumber(timeMilli));
  parts.push(writeMiniNumber(0n));
  parts.push(writeMiniData(MAX_HASH));

  parts.push(new Uint8Array([CASCADE_LEVELS]));
  parts.push(writeHashToStream(ZERO_HASH));

  parts.push(writeHashToStream(ZERO_HASH));
  parts.push(writeMiniNumber(0n));

  parts.push(serializeMagic());

  parts.push(writeHashToStream(ZERO_HASH));

  parts.push(writeHashToStream(txBodyHash));

  return concat(...parts);
}

/**
 * Compute TxPoW ID = SHA3-256(TxHeader bytes).
 * Matches Java: Crypto.getInstance().hashObject(mHeader) via SHA3Digest(256).
 */
export function computeTxPoWId(headerBytes: Uint8Array): Uint8Array {
  return sha3_256(headerBytes);
}

/**
 * Build the empty burn transaction bytes.
 *
 * Equivalent to serializeTransaction({ linkHash: new Uint8Array([0x00]),
 *                                       inputs: [], outputs: [], state: [] })
 * which produces:
 *   writeMiniNumber(0n)              inputs count
 *   writeMiniNumber(0n)              outputs count
 *   writeMiniNumber(0n)              state count
 *   writeHashToStream([0x00])        linkHash = ZERO_TXPOWID (1 byte)
 */
function buildEmptyBurnTxBytes(): Uint8Array {
  return concat(
    writeMiniNumber(0n),
    writeMiniNumber(0n),
    writeMiniNumber(0n),
    writeHashToStream(new Uint8Array([0x00]))
  );
}

/**
 * Build the empty burn witness bytes.
 *
 * Equivalent to serializeWitness() with no arguments:
 *   writeMiniNumber(0n)   signature count
 *   writeMiniNumber(0n)   coinproof count
 *   writeMiniNumber(0n)   scriptproof count
 */
function buildEmptyBurnWitnessBytes(): Uint8Array {
  return concat(
    writeMiniNumber(0n),
    writeMiniNumber(0n),
    writeMiniNumber(0n)
  );
}

/**
 * Serialize a TxBody per Minima's TxBody.writeDataStream().
 *
 * @param txBytes       Pre-serialized Transaction bytes (from @totemsdk/core's serializeTransaction)
 * @param witnessBytes  Pre-serialized Witness bytes (from extension's serializeWitness)
 * @param options       Optional txnDifficulty override and test PRNG
 */
export function serializeTxBody(
  txBytes: Uint8Array,
  witnessBytes: Uint8Array,
  options?: TxBodyOptions
): Uint8Array {
  const txnDifficulty = options?.txnDifficulty ?? MAX_HASH;

  let prng: Uint8Array;
  if (options?.prng) {
    prng = options.prng;
  } else {
    prng = new Uint8Array(32);
    if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
      throw new Error(
        'SECURITY: crypto.getRandomValues unavailable — cannot generate secure random bytes for transaction PRNG'
      );
    }
    crypto.getRandomValues(prng);
  }

  return concat(
    writeHashToStream(prng),
    writeMiniData(txnDifficulty),
    txBytes,
    witnessBytes,
    buildEmptyBurnTxBytes(),
    buildEmptyBurnWitnessBytes(),
    writeMiniNumber(0n)
  );
}

/**
 * Serialize a complete TxPoW per Minima's TxPoW.writeDataStream().
 *
 * Assembles TxBody from pre-serialized tx+witness bytes, hashes the body to
 * obtain mTxBodyHash, builds TxHeader with nonce=0, then concatenates:
 *   TxHeader | 0x01 (hasBody) | TxBody
 *
 * The returned bytes have nonce=0. Pass them to mineTxPoW() to find a valid
 * nonce for local mining, or send as-is when MEG will re-mine.
 *
 * @param txBytes       Pre-serialized Transaction bytes
 * @param witnessBytes  Pre-serialized Witness bytes
 * @param options       Optional txnDifficulty, nonce, timeMilli, prng
 */
export function serializeTxPoW(
  txBytes: Uint8Array,
  witnessBytes: Uint8Array,
  options?: TxPoWOptions
): Uint8Array {
  const txBody = serializeTxBody(txBytes, witnessBytes, options);
  const txBodyHash = sha3_256(txBody);

  return concat(
    serializeTxHeader(txBodyHash, options),
    new Uint8Array([0x01]),
    txBody
  );
}
