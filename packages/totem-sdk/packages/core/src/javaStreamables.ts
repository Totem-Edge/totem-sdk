/**
 * Java-Compatible Serialization Helpers
 * 
 * Matches Minima Java serialization exactly:
 * - MiniNumber.java: writeDataStream / readDataStream
 * - MiniData.java: writeDataStream / readDataStream  
 * - Crypto.java: hashAllObjects - serializes Streamables then SHA3-256
 * 
 * These helpers are used for seed derivation to match TreeKeyNode.java:
 *   MiniData seed = Crypto.getInstance().hashAllObjects(new MiniNumber(i), zPrivateSeed);
 * 
 * NOTE: This module provides number-based wrappers for backward compatibility.
 * The canonical implementations are in Streamable.ts which uses bigint for precision.
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import { 
  writeMiniNumber as streamableWriteMiniNumber,
  writeMiniData as streamableWriteMiniData,
  writeHashToStream as streamableWriteHashToStream,
  bigIntToByteArray
} from './Streamable.js';

/**
 * Serialize a number in MiniNumber format (Java compatible)
 * 
 * Thin wrapper over Streamable.writeMiniNumber that accepts number for backward compatibility.
 * 
 * @param n - Non-negative integer to serialize
 * @returns Serialized bytes matching Java MiniNumber format
 */
export function serializeMiniNumber(n: number): Uint8Array {
  if (n < 0) throw new Error('MiniNumber must be non-negative');
  return streamableWriteMiniNumber(BigInt(n));
}

/**
 * Serialize bytes in MiniData format (Java compatible)
 * 
 * Re-export of Streamable.writeMiniData for backward compatibility.
 * 
 * @param data - Bytes to serialize
 * @returns Serialized bytes matching Java MiniData format
 */
export function serializeMiniData(data: Uint8Array): Uint8Array {
  return streamableWriteMiniData(data);
}

/**
 * Hash multiple Streamable objects (Java compatible)
 * 
 * From Crypto.java hashAllObjects:
 *   1. Write each object to DataOutputStream
 *   2. SHA3-256 hash the combined bytes
 * 
 * This matches TreeKeyNode.java seed derivation:
 *   Crypto.getInstance().hashAllObjects(new MiniNumber(i), zPrivateSeed)
 * 
 * @param items - Array of serialized objects (use serializeMiniNumber/serializeMiniData)
 * @returns 32-byte SHA3-256 hash
 */
export function hashAllObjects(...items: Uint8Array[]): Uint8Array {
  // Concatenate all serialized items
  const totalLength = items.reduce((sum, item) => sum + item.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const item of items) {
    combined.set(item, offset);
    offset += item.length;
  }
  
  // SHA3-256 hash
  return sha3_256(combined);
}

/**
 * Derive per-chain seed matching Java TreeKeyNode.java exactly
 * 
 * From TreeKeyNode.java constructor (line 43-44):
 *   MiniData seed = Crypto.getInstance().hashAllObjects(new MiniNumber(i), zPrivateSeed);
 * 
 * @param privateSeed - 32-byte private seed
 * @param index - Chain index (0-63)
 * @returns 32-byte derived seed for this chain
 */
export function deriveChainSeedJava(privateSeed: Uint8Array, index: number): Uint8Array {
  const indexSerialized = serializeMiniNumber(index);
  const seedSerialized = serializeMiniData(privateSeed);
  return hashAllObjects(indexSerialized, seedSerialized);
}

/**
 * Derive child tree seed matching Java TreeKeyNode.java exactly
 * 
 * From TreeKeyNode.java getChild (line 68):
 *   MiniData seed = Crypto.getInstance().hashAllObjects(new MiniNumber(zChild), mChildSeed);
 * 
 * The child seed is derived from parent's private seed:
 *   mChildSeed = Crypto.getInstance().hashObject(zPrivateSeed); // line 30
 * 
 * @param childSeed - 32-byte child seed (hash of parent's private seed)
 * @param childIndex - Child index (0-63)
 * @returns 32-byte derived seed for child tree
 */
export function deriveChildTreeSeedJava(childSeed: Uint8Array, childIndex: number): Uint8Array {
  const indexSerialized = serializeMiniNumber(childIndex);
  const seedSerialized = serializeMiniData(childSeed);
  return hashAllObjects(indexSerialized, seedSerialized);
}

/**
 * Hash a single object matching Java's Crypto.hashObject()
 * 
 * From TreeKeyNode.java line 30:
 *   mChildSeed = Crypto.getInstance().hashObject(zPrivateSeed);
 * 
 * This serializes the object as MiniData (length-prefixed) and hashes it.
 * 
 * @param data - Raw bytes (will be serialized as MiniData)
 * @returns 32-byte SHA3-256 hash
 */
export function hashObject(data: Uint8Array): Uint8Array {
  const serialized = serializeMiniData(data);
  return sha3_256(serialized);
}

/**
 * Convert index to MiniData bytes matching Java's:
 *   new MiniData(new BigInteger(Integer.toString(index)))
 * 
 * BigInteger uses minimum byte representation (no leading zeros).
 * This is used for per-address key derivation in Wallet.java.
 * 
 * @param index - Non-negative integer (0, 1, 2, ...)
 * @returns Minimal byte representation of the index
 */
export function indexToMiniDataBytes(index: number): Uint8Array {
  if (index === 0) {
    return new Uint8Array([0x00]);
  }
  
  // Convert to minimum byte representation (big-endian, no leading zeros)
  const bytes: number[] = [];
  let n = index;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n = n >> 8;
  }
  
  return new Uint8Array(bytes);
}

/**
 * Derive per-address private seed matching Minima Wallet.java exactly
 * 
 * From Wallet.java createNewKey() (lines 498-503):
 *   MiniData modifier = new MiniData(new BigInteger(Integer.toString(numkeys)));
 *   MiniData privseed = Crypto.getInstance().hashObjects(new MiniData(mBaseSeed.getSeed()), modifier);
 * 
 * CRITICAL: This is DIFFERENT from deriveChainSeedJava!
 * - deriveChainSeedJava: hashAllObjects(MiniNumber(index), MiniData(seed)) - index first as MiniNumber
 * - This function: hashObjects(MiniData(baseSeed), MiniData(modifier)) - baseSeed first, both as MiniData
 * 
 * @param baseSeed - 32-byte base wallet seed (from mnemonic)
 * @param addressIndex - Address index (0, 1, 2, ... 63)
 * @returns 32-byte private seed for this address's TreeKey
 */
export function derivePerAddressSeed(baseSeed: Uint8Array, addressIndex: number): Uint8Array {
  // Step 1: Create modifier bytes from BigInteger representation of index
  const modifierBytes = indexToMiniDataBytes(addressIndex);
  
  // Step 2: Serialize both as MiniData (4-byte length prefix each)
  const baseSeedSerialized = serializeMiniData(baseSeed);
  const modifierSerialized = serializeMiniData(modifierBytes);
  
  // Step 3: Concatenate and hash (baseSeed FIRST, then modifier)
  const combined = new Uint8Array(baseSeedSerialized.length + modifierSerialized.length);
  combined.set(baseSeedSerialized, 0);
  combined.set(modifierSerialized, baseSeedSerialized.length);
  
  const result = sha3_256(combined);
  
  // DIAGNOSTIC: Log first 8 bytes to detect bundle duplication or implementation differences
  // Enable via: globalThis.TOTEM_SEED_DEBUG = true
  if (typeof console !== 'undefined' && (globalThis as any).TOTEM_SEED_DEBUG) {
    const toHex = (b: Uint8Array) => Array.from(b.slice(0, 8)).map(x => x.toString(16).padStart(2, '0')).join('');
    console.log(`[derivePerAddressSeed] idx=${addressIndex} baseSeed[0:8]=${toHex(baseSeed)} -> result[0:8]=${toHex(result)}`);
  }
  
  return result;
}

/**
 * Serialize MiniNumber.ZERO - cached for performance
 * Returns: [0x00, 0x01, 0x00] = scale(0) + length(1) + value(0)
 */
export function serializeMiniNumberZERO(): Uint8Array {
  return new Uint8Array([0x00, 0x01, 0x00]);
}

/**
 * Serialize MiniNumber.ONE
 * Returns: [0x00, 0x01, 0x01] = scale(0) + length(1) + value(1)
 */
export function serializeMiniNumberONE(): Uint8Array {
  return new Uint8Array([0x00, 0x01, 0x01]);
}

/**
 * Serialize hash in MiniData.writeHashToStream format (4-byte length prefix)
 * 
 * Re-export of Streamable.writeHashToStream for backward compatibility.
 * 
 * @param data - Hash bytes (max 64 bytes per MINIMA_MAX_HASH_LENGTH)
 * @returns Serialized bytes with 4-byte length prefix
 */
export function writeHashToStream(data: Uint8Array): Uint8Array {
  return streamableWriteHashToStream(data);
}

/**
 * Java hashAllObjects for MMRData hashing
 * Used for MMRData.CreateMMRDataLeafNode and CreateMMRDataParentNode
 * 
 * From Crypto.java hashAllObjects:
 * Serializes each Streamable object and hashes the concatenation.
 * 
 * For MMRData, the serialization is:
 * - MiniNumber: [scale][len][data] (see serializeMiniNumber)
 * - MiniData: [4-byte len][data] for writeDataStream
 * - Hash: [4-byte len][data] for writeHashToStream (same as MiniData)
 * 
 * CRITICAL: Java writeHashToStream uses writeInt (4-byte prefix),
 * identical to writeDataStream. See MiniData.java lines 282-289.
 * 
 * @param items - Pre-serialized items to concatenate and hash
 * @returns 32-byte SHA3-256 hash
 */
export function javaHashAllObjects(...items: Uint8Array[]): Uint8Array {
  const totalLength = items.reduce((sum, item) => sum + item.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const item of items) {
    combined.set(item, offset);
    offset += item.length;
  }
  return sha3_256(combined);
}

/**
 * MMREntryNumber interface matching Minima's MMREntryNumber.java
 * Represents a BigDecimal position in the MMR tree
 */
export interface MMREntryNumber {
  scale: number;       // BigDecimal scale (typically 0 for integer positions)
  unscaled: bigint;    // BigDecimal unscaled value
}

/**
 * Create MMREntryNumber from bigint (common case for integer positions)
 */
export function createMMREntryNumber(value: bigint): MMREntryNumber {
  return { scale: 0, unscaled: value };
}

/**
 * Serialize MMREntryNumber matching Java MMREntryNumber.writeDataStream()
 * 
 * From MMREntryNumber.java:
 *   MiniNumber.WriteToStream(zOut, mNumber.scale());
 *   MiniData.WriteToStream(zOut, mNumber.unscaledValue().toByteArray());
 * 
 * @param entry - MMREntryNumber to serialize
 * @returns Serialized bytes: MiniNumber(scale) + MiniData(unscaled bytes)
 */
export function serializeMMREntryNumber(entry: MMREntryNumber): Uint8Array {
  const scaleSerialized = serializeMiniNumber(entry.scale);
  const unscaledBytes = bigintToSignedBytes(entry.unscaled);
  const unscaledSerialized = serializeMiniData(unscaledBytes);
  
  const result = new Uint8Array(scaleSerialized.length + unscaledSerialized.length);
  result.set(scaleSerialized, 0);
  result.set(unscaledSerialized, scaleSerialized.length);
  return result;
}

/**
 * Convert bigint to Java BigInteger.toByteArray() format (big-endian, signed two's complement)
 * Uses the canonical implementation from Streamable.ts
 */
function bigintToSignedBytes(n: bigint): Uint8Array {
  return bigIntToByteArray(n);
}

/**
 * MMRData interface for serialization purposes
 * Matches Minima's MMRData.java
 */
export interface MMRData {
  data: Uint8Array;    // 32-byte hash
  value: bigint;       // Sum value (typically 0n for TreeKey)
}

/**
 * Serialize MMRData matching Java MMRData.writeDataStream()
 * 
 * From MMRData.java:
 *   mData.writeHashToStream(zOut);  // 4-byte length prefix + hash bytes
 *   mValue.writeDataStream(zOut);   // MiniNumber format
 * 
 * @param mmrData - MMRData to serialize
 * @returns Serialized bytes: writeHashToStream(hash) + MiniNumber(value)
 */
export function serializeMMRData(mmrData: MMRData): Uint8Array {
  const hashSerialized = writeHashToStream(mmrData.data);
  const valueSerialized = serializeMiniNumber(Number(mmrData.value));
  
  const result = new Uint8Array(hashSerialized.length + valueSerialized.length);
  result.set(hashSerialized, 0);
  result.set(valueSerialized, hashSerialized.length);
  return result;
}

/**
 * MMREntry interface for serialization purposes
 * Matches Minima's MMREntry.java
 */
export interface MMREntry {
  row: number;
  entryNumber: MMREntryNumber;
  mmrData: MMRData;
}

/**
 * Serialize MMREntry matching Java MMREntry.writeDataStream()
 * 
 * From MMREntry.java:
 *   MiniNumber row = new MiniNumber(mRow);
 *   row.writeDataStream(zOut);
 *   mEntryNumber.writeDataStream(zOut);
 *   mMMRData.writeDataStream(zOut);
 * 
 * @param entry - MMREntry to serialize
 * @returns Serialized bytes: MiniNumber(row) + MMREntryNumber + MMRData
 */
export function serializeMMREntry(entry: MMREntry): Uint8Array {
  const rowSerialized = serializeMiniNumber(entry.row);
  const entryNumberSerialized = serializeMMREntryNumber(entry.entryNumber);
  const mmrDataSerialized = serializeMMRData(entry.mmrData);
  
  const totalLength = rowSerialized.length + entryNumberSerialized.length + mmrDataSerialized.length;
  const result = new Uint8Array(totalLength);
  
  let offset = 0;
  result.set(rowSerialized, offset);
  offset += rowSerialized.length;
  result.set(entryNumberSerialized, offset);
  offset += entryNumberSerialized.length;
  result.set(mmrDataSerialized, offset);
  
  return result;
}

/**
 * Derive the unified root private seed from a base wallet seed.
 *
 * Architecture:
 *   root_priv_seed = SHA3-256( serializeMiniData(baseSeed) ‖ serializeMiniData("ROOT_IDENTITY" bytes) )
 *
 * @param baseSeed - 32-byte wallet base seed (from mnemonic)
 * @returns 32-byte root private seed
 */
export function deriveRootPrivSeed(baseSeed: Uint8Array): Uint8Array {
  const baseSeedSerialized = serializeMiniData(baseSeed);
  const rootIdentityBytes = new TextEncoder().encode('ROOT_IDENTITY');
  const rootIdentitySerialized = serializeMiniData(rootIdentityBytes);
  const combined = new Uint8Array(baseSeedSerialized.length + rootIdentitySerialized.length);
  combined.set(baseSeedSerialized, 0);
  combined.set(rootIdentitySerialized, baseSeedSerialized.length);
  return sha3_256(combined);
}

/**
 * Derive a unified child seed for the address at `index`.
 *
 * Architecture:
 *   child_seed_i = SHA3-256( serializeMiniData(root_priv_seed) ‖ serializeMiniData(indexBytes(i)) )
 *
 * @param baseSeed - 32-byte wallet base seed (from mnemonic)
 * @param index - Address index (0-63)
 * @returns 32-byte child seed for the TreeKey at this address
 */
export function deriveUnifiedChildSeed(baseSeed: Uint8Array, index: number): Uint8Array {
  const rootPrivSeed = deriveRootPrivSeed(baseSeed);
  const modifierBytes = indexToMiniDataBytes(index);
  const rootSeedSerialized = serializeMiniData(rootPrivSeed);
  const modifierSerialized = serializeMiniData(modifierBytes);
  const combined = new Uint8Array(rootSeedSerialized.length + modifierSerialized.length);
  combined.set(rootSeedSerialized, 0);
  combined.set(modifierSerialized, rootSeedSerialized.length);
  return sha3_256(combined);
}

/**
 * Precompute output coin IDs before computing the transaction digest.
 * 
 * CRITICAL: Java's txnsign command calls TxPoWGenerator.precomputeTransactionCoinID(txn)
 * BEFORE calculateTransactionID(). This means the transaction digest that gets signed
 * includes the PRECOMPUTED output coin IDs, not the placeholder 0x00.
 * 
 * Formula: outputCoinID = SHA3-256( writeMiniData(input[0].coinID) || writeMiniNumber(outputIndex) )
 * This matches Java's Crypto.hashObjects(baseCoinID, new MiniNumber(outputNum))
 * 
 * Without this, the wallet signs a different digest than what the node verifies against,
 * causing allsignaturesvalid=false on every transaction.
 * 
 * @param inputs - Transaction inputs array, each must have a coinId (Uint8Array)
 * @param outputs - Transaction outputs array, each will have its coinId mutated in-place
 */
export function precomputeTransactionCoinID(
  inputs: { coinId: Uint8Array }[],
  outputs: { coinId: Uint8Array }[]
): void {
  if (inputs.length === 0) return;

  const baseCoinId = inputs[0].coinId;

  if (baseCoinId.length < 2) {
    throw new Error(
      `Cannot precompute output coinIDs: input[0].coinId is ${baseCoinId.length} byte(s) ` +
      `(placeholder?). Real coinId from CoinProof required for signing.`
    );
  }

  for (let i = 0; i < outputs.length; i++) {
    const baseCoinIdStream = streamableWriteMiniData(baseCoinId);
    const outputIndexStream = streamableWriteMiniNumber(BigInt(i));
    const combined = new Uint8Array(baseCoinIdStream.length + outputIndexStream.length);
    combined.set(baseCoinIdStream, 0);
    combined.set(outputIndexStream, baseCoinIdStream.length);
    outputs[i].coinId = sha3_256(combined);
  }
}
