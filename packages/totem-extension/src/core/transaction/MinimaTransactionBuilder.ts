import { sha3_256 } from 'js-sha3';
import { serializeTxPoW as sdkSerializeTxPoW } from '@totemsdk/txpow';
import { mxToHex } from '../utils/minima-base32';
import { TxSerializeLogger, TxBuildLogger } from './TxLogger';
import {
  writeMiniNumber,
  writeMiniData,
  writeHashToStream,
  writeMiniByte,
  writeMMREntryNumber,
  concat as streamableConcat,
  hexToBytes as streamableHexToBytes,
  bytesToHex as streamableBytesToHex,
} from '../../../../totem-sdk/packages/core/src/Streamable';

const BUILD_VERSION = 'v2025.06.28.FIX12-mx-address-support';
const BUILD_TIMESTAMP = '1735406100';

const MINIMA_DECIMALS = 44;

/**
 * Normalize address to hex format - handles both Mx and 0x formats
 */
function normalizeAddressToHex(addr: string): string {
  if (!addr) {
    TxBuildLogger.warn('Empty address, defaulting to 0x00');
    return '0x00';
  }
  const trimmed = addr.trim();
  
  if (trimmed.toLowerCase().startsWith('mx')) {
    try {
      const hexResult = mxToHex(trimmed);
      TxBuildLogger.debug('Mx→Hex conversion', { input: trimmed.substring(0, 15), output: hexResult.substring(0, 15) });
      return hexResult;
    } catch (e: any) {
      TxBuildLogger.error(`Mx→Hex conversion failed: ${e.message}`, { input: trimmed.substring(0, 20) });
      throw new Error(`Invalid Mx address "${trimmed.substring(0, 20)}...": ${e.message}`);
    }
  }
  
  const hexAddr = trimmed.startsWith('0x') ? trimmed : '0x' + trimmed;
  const cleanHex = hexAddr.slice(2);
  if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
    TxBuildLogger.error('Invalid hex characters in address', { input: trimmed.substring(0, 20) });
    throw new Error(`Invalid hex address: contains non-hex characters`);
  }
  if (cleanHex.length % 2 !== 0) {
    TxBuildLogger.error('Odd-length hex address', { input: trimmed, length: cleanHex.length });
    throw new Error(`Invalid hex address: odd length (${cleanHex.length} chars)`);
  }
  
  return hexAddr;
}
const ZERO_HASH = new Uint8Array(32);

// CRITICAL: Java's MiniData.ZERO_TXPOWID = new MiniData("0x00") is 1 BYTE, not 32!
// This is the default linkHash value used by Transaction class.
// Using 32 bytes causes a 31-byte mismatch in serialization, breaking transaction ID.
const ZERO_TXPOWID = new Uint8Array([0x00]);

export interface MinimaTransaction {
  linkHash: Uint8Array;
  inputs: MinimaCoin[];
  outputs: MinimaCoin[];
  state: StateVariable[];
}

export interface MinimaCoin {
  coinId: Uint8Array;
  address: Uint8Array;
  amount: string;  // Original decimal string from API (e.g., "0.0001", "36000")
  tokenId: Uint8Array;
  token: MinimaToken | null;
  storeState: boolean;
  state: StateVariable[] | RawStateVariable[];  // High-level or raw state variables
  mmrEntryNumber: bigint;
  spent: boolean;
  created: bigint;
  /**
   * Raw amount bytes extracted from CoinProof (optional).
   * When present, these bytes are used INSTEAD of re-encoding from the decimal string.
   * This ensures byte-exact match with the blockchain's original amount encoding.
   * Format: [scale: 1 byte][len: 1 byte][unscaledValue: len bytes]
   */
  rawAmountBytes?: Uint8Array;
  /**
   * Raw MMREntryNumber bytes extracted from CoinProof (optional).
   * When present, these bytes are used for byte-exact serialization.
   */
  rawMmrEntryBytes?: Uint8Array;
  /**
   * Raw blockCreated bytes extracted from CoinProof (optional).
   * When present, these bytes are used for byte-exact serialization.
   */
  rawBlockCreatedBytes?: Uint8Array;
  /**
   * Raw token bytes extracted from CoinProof (optional).
   * When present, written verbatim with hasToken=1 so Java can deserialize the Token object.
   * Contains the 5-field token metadata: coinId, scale, totalAmount, name, script.
   * Native Minima coins leave this undefined → hasToken=0 byte is written instead.
   */
  rawTokenData?: Uint8Array;
}

/**
 * Parsed MiniNumber representation matching Java BigDecimal serialization.
 * 
 * Java's MiniNumber.writeDataStream() writes:
 *   - scale: 1 byte (signed)
 *   - length: 1 byte
 *   - unscaledValue: BigInteger bytes
 * 
 * Examples:
 *   "36000" → {scale: 0, unscaledValue: 36000n} → 00 03 00 8C A0
 *   "0.0001" → {scale: 4, unscaledValue: 1n} → 04 01 01
 */
export interface ParsedMiniNumber {
  scale: number;
  unscaledValue: bigint;
}

export interface MinimaToken {
  coinId: Uint8Array;
  scale: number;
  totalAmount: bigint;
  name: Uint8Array;
  script: Uint8Array;
  created?: bigint;
}

/**
 * StateVariable matching Java's StateVariable.java format.
 * 
 * JAVA SERIALIZATION FORMAT:
 *   1. port (MiniByte - 1 byte, 0-255)
 *   2. type (MiniByte - 1 byte: HEX=1, NUMBER=2, STRING=4, BOOL=8)
 *   3. data (format depends on type):
 *      - BOOL: MiniByte (1 byte: 0 or 1)
 *      - HEX: MiniData (4-byte length + hex bytes)
 *      - NUMBER: MiniNumber (1-byte scale + 1-byte len + data)
 *      - STRING: MiniString (4-byte length + UTF-8 with brackets)
 * 
 * UNIFIED (2026-01-20): Now stores high-level value, encoding happens at serialization.
 * This matches WitnessSerializer.encodeStateValue() and eliminates pre-encoding issues.
 */
export interface StateVariable {
  port: number;
  value: string | bigint | boolean | Uint8Array;
  type: 'bool' | 'number' | 'hex' | 'string';
}

/**
 * Input coin for transaction building.
 * CRITICAL: amount must be in BASE UNITS (44 decimal precision as string).
 * Convert decimal amounts to base units BEFORE passing to buildTransaction.
 * Example: "0.0001" MINIMA = "10000000000000000000000000000000000000000" base units
 */
/**
 * Raw state variable extracted from CoinProof with pre-serialized data.
 * Used for byte-exact transaction serialization matching Java.
 */
export interface RawStateVariable {
  port: number;
  type: number;  // 1=HEX, 2=NUMBER, 4=STRING, 8=BOOL
  rawData: Uint8Array;  // Pre-serialized data for byte-exact match
}

/**
 * Complete coin data extracted from CoinProof for byte-exact transaction serialization.
 * These fields MUST match the original blockchain values to produce correct transaction IDs.
 */
export interface CoinProofData {
  coinId: Uint8Array;          // 32 bytes
  address: Uint8Array;         // 32 bytes
  rawAmountBytes: Uint8Array;  // [scale][len][data...]
  tokenId: Uint8Array;         // Variable length
  storeState: boolean;
  mmrEntryNumber: bigint;
  rawMmrEntryBytes: Uint8Array;  // Pre-serialized MMREntryNumber for byte-exact match
  spent: boolean;
  blockCreated: bigint;
  rawBlockCreatedBytes: Uint8Array;  // Pre-serialized for byte-exact match
  state: RawStateVariable[];      // Coin state variables with raw bytes
  rawTokenData?: Uint8Array;      // Token metadata bytes (without hasToken byte); undefined for native Minima
  tokenScale?: number;            // Token scale value (from Token.mTokenScale MiniNumber); undefined for native Minima
}

export interface SpendableCoinInput {
  coinId: string;
  address: string;
  amount: string;  // Decimal string from API (e.g., "0.0001")
  tokenId: string;
  /**
   * Raw amount bytes extracted from CoinProof (optional).
   * When present, these bytes are used for BYTE-EXACT serialization
   * matching the blockchain's original encoding.
   * Format: [scale: 1 byte][len: 1 byte][unscaledValue: len bytes]
   */
  rawAmountBytes?: Uint8Array;
  /**
   * Complete coin data extracted from CoinProof (optional).
   * When present, ALL fields are used for byte-exact serialization
   * to produce transaction IDs that match Java exactly.
   */
  coinProofData?: CoinProofData;
}

export interface TransactionBuildResult {
  transaction: MinimaTransaction;
  digestTx: Uint8Array;
  digestTxHex: string;
  serialized: Uint8Array;
  serializedHex: string;
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// REMOVED: Local writeMiniNumber - now imported from Streamable.ts (canonical implementation with parity tests)

/**
 * Parse a decimal string into scale and unscaledValue matching Java BigDecimal behavior.
 * 
 * Java's BigDecimal(String) constructor determines scale from the decimal point position.
 * Examples:
 *   "36000"   → scale=0, unscaledValue=36000
 *   "0.0001"  → scale=4, unscaledValue=1
 *   "1.5"     → scale=1, unscaledValue=15
 *   "100.00"  → scale=2, unscaledValue=10000 (preserves trailing zeros)
 * 
 * CRITICAL: This must match Java's BigDecimal(String) behavior exactly for byte-exact
 * serialization compatibility with Minima's Java implementation.
 */
export function parseDecimalToMiniNumber(decimal: string): ParsedMiniNumber {
  if (!decimal || decimal === '') {
    return { scale: 0, unscaledValue: 0n };
  }
  
  // Reject scientific notation - must be converted before calling
  if (decimal.includes('e') || decimal.includes('E')) {
    throw new Error(`Scientific notation not supported: "${decimal}". Convert to plain decimal first.`);
  }
  
  // Handle negative sign
  let isNegative = false;
  let cleaned = decimal.trim();
  if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.slice(1);
  }
  
  // Find decimal point
  const dotIndex = cleaned.indexOf('.');
  
  let scale: number;
  let unscaledStr: string;
  
  if (dotIndex === -1) {
    // No decimal point - integer value, scale = 0
    scale = 0;
    unscaledStr = cleaned;
  } else {
    // Has decimal point - scale = number of digits after decimal
    const wholePart = cleaned.slice(0, dotIndex);
    const fracPart = cleaned.slice(dotIndex + 1);
    scale = fracPart.length;
    unscaledStr = wholePart + fracPart;
  }
  
  // Remove leading zeros (but keep at least one digit)
  unscaledStr = unscaledStr.replace(/^0+/, '') || '0';
  
  // Convert to bigint
  let unscaledValue = BigInt(unscaledStr);
  if (isNegative && unscaledValue !== 0n) {
    unscaledValue = -unscaledValue;
  }
  
  TxSerializeLogger.trace(`parseDecimalToMiniNumber`, { decimal, scale, unscaled: unscaledValue.toString() });
  
  return { scale, unscaledValue };
}

/**
 * Encode a parsed MiniNumber (from parseDecimalToMiniNumber) to bytes.
 */
function encodeParsedMiniNumber(parsed: ParsedMiniNumber): Uint8Array {
  return writeMiniNumber(parsed.unscaledValue, parsed.scale);
}

/**
 * Extract the raw amount bytes from a CoinProof hex string.
 * 
 * CoinProof structure (per Java CoinProof.writeDataStream):
 *   1. Coin (serialized)
 *   2. MMRProof (serialized)
 * 
 * Coin structure (per Java Coin.writeDataStream):
 *   1. coinId: writeHashToStream (4-byte len + 32 bytes = 36 bytes for standard hash)
 *   2. address: writeHashToStream (4-byte len + 32 bytes = 36 bytes)
 *   3. amount: MiniNumber (1 byte scale + 1 byte len + [len] bytes data)
 *   ...
 * 
 * This function extracts the EXACT amount bytes (scale + len + data) from the CoinProof,
 * which guarantees byte-exact match with the blockchain's original encoding.
 * 
 * @param coinProofHex - The CoinProof hex string from the API
 * @returns The raw amount bytes, or undefined if extraction fails
 */
export function extractAmountBytesFromCoinProof(coinProofHex: string): Uint8Array | undefined {
  try {
    const cleanHex = coinProofHex.startsWith('0x') ? coinProofHex.slice(2) : coinProofHex;
    const bytes = hexToBytes('0x' + cleanHex);
    
    // Helper to read 4-byte big-endian length
    const read4ByteLen = (off: number) => 
      (bytes[off] << 24) | (bytes[off+1] << 16) | (bytes[off+2] << 8) | bytes[off+3];
    
    // Parse coin structure to find amount offset
    let offset = 0;
    
    // coinId: MiniData (4-byte len + data)
    const coinIdLen = read4ByteLen(offset);
    offset += 4 + coinIdLen;
    
    // address: MiniData (4-byte len + data)
    const addrLen = read4ByteLen(offset);
    offset += 4 + addrLen;
    
    // Now we're at the amount MiniNumber
    // Format: [scale: 1 byte][len: 1 byte][data: len bytes]
    const amountScale = bytes[offset];
    const amountLen = bytes[offset + 1];
    const totalAmountBytes = 2 + amountLen; // scale + len + data
    
    // Extract the raw amount bytes
    const amountBytes = bytes.slice(offset, offset + totalAmountBytes);
    
    TxSerializeLogger.trace('Extracted amount from CoinProof', { scale: amountScale, len: amountLen });
    
    return amountBytes;
  } catch (e: any) {
    TxSerializeLogger.warn(`Failed to extract amount from CoinProof: ${e.message}`);
    return undefined;
  }
}

/**
 * Extract COMPLETE coin data from a CoinProof for byte-exact transaction serialization.
 * 
 * This is CRITICAL for transaction ID matching with Java. The transaction ID is computed
 * from the serialized transaction bytes, which includes ALL coin fields (mmrEntryNumber,
 * blockCreated, state, etc.). Using hardcoded defaults produces different bytes than
 * the original coin, causing transaction ID mismatch and signature verification failure.
 * 
 * CoinProof structure:
 *   Coin (coinId, address, amount, tokenId, storeState, mmrEntryNumber, spent, blockCreated, state, token)
 *   MMRProof (blockTime, proofChunks)
 * 
 * @param coinProofHex - The CoinProof hex string from the API
 * @returns Complete coin data, or undefined if extraction fails
 */
export function extractCoinDataFromCoinProof(coinProofHex: string): CoinProofData | undefined {
  try {
    const cleanHex = coinProofHex.startsWith('0x') ? coinProofHex.slice(2) : coinProofHex;
    let bytes = hexToBytes('0x' + cleanHex);

    // Apply fixCoinProofMiniNumbers BEFORE parsing so rawTokenData comes from the same
    // fixed bytes that serializeWitness puts in the witness CoinProof.
    // If any token field MiniNumber had len=0, Java would throw "Zero length BigInteger"
    // when reading the transaction body — this ensures byte-level consistency.
    bytes = fixCoinProofMiniNumbers(bytes, 0);
    
    const read4ByteLen = (off: number) => 
      (bytes[off] << 24) | (bytes[off+1] << 16) | (bytes[off+2] << 8) | bytes[off+3];
    
    let offset = 0;
    
    // 1. coinId: MiniData (4-byte len + data)
    const coinIdLen = read4ByteLen(offset);
    offset += 4;
    const coinId = bytes.slice(offset, offset + coinIdLen);
    offset += coinIdLen;
    
    // 2. address: MiniData (4-byte len + data)
    const addrLen = read4ByteLen(offset);
    offset += 4;
    const address = bytes.slice(offset, offset + addrLen);
    offset += addrLen;
    
    // 3. amount: MiniNumber [scale][len][data...]
    const amountScale = bytes[offset];
    const amountLen = bytes[offset + 1];
    const rawAmountBytes = bytes.slice(offset, offset + 2 + amountLen);
    offset += 2 + amountLen;
    
    // 4. tokenId: MiniData
    const tokenIdLen = read4ByteLen(offset);
    offset += 4;
    const tokenId = bytes.slice(offset, offset + tokenIdLen);
    offset += tokenIdLen;
    
    // 5. storeState: MiniByte (0 or 1)
    const storeState = bytes[offset] === 1;
    offset += 1;
    
    // 6. mmrEntryNumber: MMREntryNumber (MiniNumber scale + MiniData unscaled)
    //    Format: [scale: 1 byte][len: 1 byte][data...] + [4-byte len][data...]
    const mmrStart = offset;
    const mmrScaleLen = bytes[offset + 1];
    offset += 2 + mmrScaleLen;
    const mmrDataLen = read4ByteLen(offset);
    offset += 4 + mmrDataLen;
    const rawMmrEntryBytes = bytes.slice(mmrStart, offset);
    
    // Parse the actual mmrEntryNumber value
    let mmrEntryNumber = 0n;
    // The MMREntryNumber value is in the MiniData portion (last part)
    const mmrDataStart = mmrStart + 2 + mmrScaleLen + 4;
    if (mmrDataLen > 0) {
      mmrEntryNumber = bytes.slice(mmrDataStart, mmrDataStart + mmrDataLen).reduce(
        (acc, b) => (acc << 8n) | BigInt(b), 0n
      );
    }
    
    // 7. spent: MiniByte
    const spent = bytes[offset] === 1;
    offset += 1;
    
    // 8. blockCreated: MiniNumber [scale][len][data...]
    const createdStart = offset;
    const createdLen = bytes[offset + 1];
    const rawBlockCreatedBytes = bytes.slice(offset, offset + 2 + createdLen);
    offset += 2 + createdLen;
    
    // Parse blockCreated value
    let blockCreated = 0n;
    if (createdLen > 0) {
      blockCreated = bytes.slice(createdStart + 2, createdStart + 2 + createdLen).reduce(
        (acc, b) => (acc << 8n) | BigInt(b), 0n
      );
    }
    
    // 9. state: MiniNumber count + StateVariable[]
    const stateCountLen = bytes[offset + 1];
    let stateCount = 0;
    if (stateCountLen > 0) {
      stateCount = bytes[offset + 2];
    }
    offset += 2 + stateCountLen;
    
    const state: RawStateVariable[] = [];
    for (let s = 0; s < stateCount && s < 256; s++) {
      const port = bytes[offset];
      offset += 1;
      const type = bytes[offset];
      offset += 1;
      
      let dataLen = 0;
      let rawData: Uint8Array;
      
      if (type === 1) {
        // HEX: MiniData (4-byte len + data)
        dataLen = read4ByteLen(offset);
        rawData = bytes.slice(offset, offset + 4 + dataLen);
        offset += 4 + dataLen;
      } else if (type === 2) {
        // NUMBER: MiniNumber [scale][len][data]
        const numLen = bytes[offset + 1];
        rawData = bytes.slice(offset, offset + 2 + numLen);
        offset += 2 + numLen;
      } else if (type === 4) {
        // STRING: MiniString (wrapped MiniData)
        dataLen = read4ByteLen(offset);
        rawData = bytes.slice(offset, offset + 4 + dataLen);
        offset += 4 + dataLen;
      } else if (type === 8) {
        // BOOL: MiniByte
        rawData = bytes.slice(offset, offset + 1);
        offset += 1;
      } else {
        // Unknown type - skip safely
        TxSerializeLogger.warn(`Unknown state type ${type} at port ${port}`);
        rawData = new Uint8Array(0);
      }
      
      state.push({ port, type, rawData });
    }

    // 10. hasToken: MiniByte + optional Token data
    // Java's Coin.writeDataStream() writes hasToken=1 + 5 token fields for all custom token coins.
    // We capture the raw token bytes verbatim so serializeCoin can write hasToken=1 for Java parity.
    // Native Minima coins have hasToken=0 → rawTokenData stays undefined → hasToken=0 written.
    const hasToken = bytes[offset];
    offset += 1;
    let rawTokenData: Uint8Array | undefined;
    let tokenScale: number | undefined;
    if (hasToken === 1) {
      const tokenDataStart = offset;
      // Java Token.writeDataStream() order (verified against Token.java source):
      // 1. coinId:      MiniData.writeHashToStream  → [4-byte len][data]
      // 2. script:      MiniString → MiniData       → [4-byte len][utf-8 bytes]
      // 3. scale:       MiniNumber                  → [scale][len][data...]
      // 4. totalAmount: MiniNumber                  → [scale][len][data...]
      // 5. name:        MiniString → MiniData       → [4-byte len][utf-8 bytes]
      // 6. created:     MiniNumber                  → [scale][len][data...]
      const tokenCoinIdLen = read4ByteLen(offset);
      offset += 4 + tokenCoinIdLen;
      const tokenScriptLen = read4ByteLen(offset);
      offset += 4 + tokenScriptLen;
      // token.scale: MiniNumber [mnScale][len][unscaledBytes...]
      // This is the token creator's scale value (e.g. 36 for porq).
      // minimaAmount = displayTokenAmount × 10^(-tokenScale)
      const tokenScaleMnScale = bytes[offset];       // MiniNumber's own decimal scale (usually 0)
      const tokenScaleLen = bytes[offset + 1];
      if (tokenScaleLen > 0) {
        let raw = 0n;
        for (let i = 0; i < tokenScaleLen; i++) {
          raw = (raw << 8n) | BigInt(bytes[offset + 2 + i]);
        }
        // Java uses BigInteger.toByteArray() — two's-complement, big-endian.
        // Token scale is always a small non-negative integer (e.g. 36), so no sign issue.
        const rawNum = Number(raw);
        // Apply MiniNumber's own scale: tokenScaleValue = rawNum × 10^(-tokenScaleMnScale)
        // In practice tokenScaleMnScale is always 0 for token scales (they are integers).
        tokenScale = tokenScaleMnScale === 0 ? rawNum : rawNum / Math.pow(10, tokenScaleMnScale);
      } else {
        tokenScale = 0;
      }
      offset += 2 + tokenScaleLen;
      const tokenTotalAmountLen = bytes[offset + 1];
      offset += 2 + tokenTotalAmountLen;
      const tokenNameLen = read4ByteLen(offset);
      offset += 4 + tokenNameLen;
      const tokenCreatedLen = bytes[offset + 1];
      offset += 2 + tokenCreatedLen;
      rawTokenData = bytes.slice(tokenDataStart, offset);
    }
    
    TxSerializeLogger.trace('Extracted complete coin data from CoinProof', {
      coinIdLen,
      addressLen: addrLen,
      mmrEntryNumber: mmrEntryNumber.toString(),
      blockCreated: blockCreated.toString(),
      stateCount: state.length,
      storeState,
      hasToken,
      rawTokenDataLen: rawTokenData?.length ?? 0,
      tokenScale
    });
    
    return {
      coinId,
      address,
      rawAmountBytes,
      tokenId,
      storeState,
      mmrEntryNumber,
      rawMmrEntryBytes,
      spent,
      blockCreated,
      rawBlockCreatedBytes,
      state,
      rawTokenData,
      tokenScale
    };
  } catch (e: any) {
    TxSerializeLogger.warn(`Failed to extract coin data from CoinProof: ${e.message}`);
    return undefined;
  }
}

/**
 * Fix MiniNumbers with len=0 in a CoinProof.
 * The server's CoinProof may contain MiniNumbers with len=0 (representing zero),
 * but Java's BigInteger(byte[]) throws "Zero length BigInteger" for empty arrays.
 * 
 * This function uses a TWO-PASS approach:
 * 1. Structural parsing to find known MiniNumber field offsets
 * 2. Brute-force scan for common [scale][0x00] patterns that structural parsing might miss
 * 
 * Any MiniNumber with len=0 is expanded to len=1 with data=0x00.
 */
function fixCoinProofMiniNumbers(proofBytes: Uint8Array, index: number): Uint8Array {
  const read4ByteLen = (bytes: Uint8Array, off: number) => 
    (bytes[off] << 24) | (bytes[off+1] << 16) | (bytes[off+2] << 8) | bytes[off+3];
  
  // Set to track unique offsets (from both structural and brute-force passes)
  const miniNumberOffsets = new Set<number>();
  
  // ===== PASS 1: STRUCTURAL PARSING =====
  try {
    let offset = 0;
    
    // ===== COIN SECTION =====
    // coinId: MiniData (4-byte len + data)
    const coinIdLen = read4ByteLen(proofBytes, 0);
    offset = 4 + coinIdLen;
    
    // address: MiniData (4-byte len + data)
    const addrLen = read4ByteLen(proofBytes, offset);
    offset += 4 + addrLen;
    
    // amount: MiniNumber
    miniNumberOffsets.add(offset);
    const amountLen = proofBytes[offset + 1];
    offset += 1 + 1 + amountLen;
    
    // tokenId: MiniData
    const tokenIdLen = read4ByteLen(proofBytes, offset);
    offset += 4 + tokenIdLen;
    
    // storeState: MiniByte
    offset += 1;
    
    // mmrEntryNumber: MMREntryNumber = MiniNumber(scale) + MiniData(unscaled)
    miniNumberOffsets.add(offset);
    const mmrScaleLen = proofBytes[offset + 1];
    offset += 1 + 1 + mmrScaleLen;
    const mmrDataLen = read4ByteLen(proofBytes, offset);
    offset += 4 + mmrDataLen;
    
    // spent: MiniByte
    offset += 1;
    
    // blockCreated: MiniNumber
    miniNumberOffsets.add(offset);
    const createdLen = proofBytes[offset + 1];
    offset += 1 + 1 + createdLen;
    
    // stateCount: MiniNumber
    miniNumberOffsets.add(offset);
    const stateLen = proofBytes[offset + 1];
    const stateCountVal = stateLen > 0 ? proofBytes[offset + 2] : 0;
    offset += 1 + 1 + stateLen;
    
    // Skip state variables (limited to prevent runaway parsing)
    const maxStateVars = Math.min(stateCountVal, 10);
    for (let s = 0; s < maxStateVars && offset < proofBytes.length - 10; s++) {
      // StateVariable: MiniByte(port) + MiniByte(type) + data
      offset += 2; // port + type
      const stateType = proofBytes[offset - 1];
      if (stateType === 1) { // HEX - MiniData
        const dataLen = read4ByteLen(proofBytes, offset);
        offset += 4 + dataLen;
      } else if (stateType === 2) { // NUMBER - MiniNumber
        miniNumberOffsets.add(offset);
        const numLen = proofBytes[offset + 1];
        offset += 1 + 1 + numLen;
      } else if (stateType === 4) { // STRING - MiniString (wrapped MiniData)
        const strLen = read4ByteLen(proofBytes, offset);
        offset += 4 + strLen;
      } else if (stateType === 8) { // BOOL - MiniByte
        offset += 1;
      }
    }
    
    // hasToken: MiniByte
    const hasToken = proofBytes[offset];
    offset += 1;
    
    // Token: Parse and advance past — Java Token bytes are always valid from Java.
    // DO NOT add token MiniNumbers to miniNumberOffsets — patching them would corrupt
    // the rawTokenData bytes that extractCoinDataFromCoinProof captures verbatim and
    // writes into the output coin. Java wrote these bytes correctly; we must not alter them.
    if (hasToken === 1) {
      // 1. token.coinId: MiniData.writeHashToStream [4-byte len][data]
      const tokenCoinIdLen = read4ByteLen(proofBytes, offset);
      offset += 4 + tokenCoinIdLen;
      // 2. token.script: MiniString → MiniData [4-byte len][data]
      const tokenScriptLen = read4ByteLen(proofBytes, offset);
      offset += 4 + tokenScriptLen;
      // 3. token.scale: MiniNumber [scale][len][data] — advance only, no patching
      const tokenScaleLen = proofBytes[offset + 1];
      offset += 2 + tokenScaleLen;
      // 4. token.totalAmount: MiniNumber [scale][len][data] — advance only, no patching
      const tokenTotalAmountLen = proofBytes[offset + 1];
      offset += 2 + tokenTotalAmountLen;
      // 5. token.name: MiniString → MiniData [4-byte len][data]
      const tokenNameLen = read4ByteLen(proofBytes, offset);
      offset += 4 + tokenNameLen;
      // 6. token.created: MiniNumber [scale][len][data] — advance only, no patching
      const tokenCreatedLen = proofBytes[offset + 1];
      offset += 2 + tokenCreatedLen;
    }
    
    const coinEndOffset = offset;
    
    // ===== MMRProof SECTION =====
    // MMRProof: MiniNumber(blockTime) + MiniNumber(count) + [MMRProofChunk...]
    // blockTime: MiniNumber
    miniNumberOffsets.add(offset);
    const blockTimeLen = proofBytes[offset + 1];
    offset += 1 + 1 + blockTimeLen;
    
    // proofChainLength: MiniNumber
    miniNumberOffsets.add(offset);
    const chainLenLen = proofBytes[offset + 1];
    const chainCount = chainLenLen > 0 ? proofBytes[offset + 2] : 0;
    offset += 1 + 1 + chainLenLen;
    
    // Parse MMRProofChunks (limited to prevent runaway)
    const maxChunks = Math.min(chainCount, 50);
    for (let c = 0; c < maxChunks && offset < proofBytes.length - 10; c++) {
      // MMRProofChunk: MiniByte(isLeft) + MMRData
      offset += 1; // isLeft
      
      // MMRData: MiniData(hash) + MiniNumber(value)
      const hashLen = read4ByteLen(proofBytes, offset);
      offset += 4 + hashLen;
      
      // value: MiniNumber - RECORD OFFSET
      miniNumberOffsets.add(offset);
      const valueLen = proofBytes[offset + 1];
      offset += 1 + 1 + valueLen;
    }
    
    TxSerializeLogger.trace('CoinProof structural parse', { index, offsetsFound: miniNumberOffsets.size, coinEndOffset });
    
  } catch (e) {
    TxSerializeLogger.trace(`CoinProof structural parse error at index ${index}`);
  }
  
  // ===== PASS 2: BRUTE-FORCE SCAN FOR ZERO-LENGTH MININUMBERS =====
  // Only scan for zero-length MiniNumbers that structural parsing explicitly found but didn't fix
  // DO NOT use aggressive pattern matching - it causes false positives on MiniData length prefixes
  // 
  // The structural parser should find all MiniNumber fields. If it missed any, they likely have
  // non-zero lengths and won't cause crashes anyway.
  //
  // DISABLED: The brute-force approach was finding false positives like:
  // - MiniData length prefixes [0x00][0x00][0x00][len] look like [scale=0][len=0]...
  // - Hash data containing [0x00][0x00] byte sequences
  //
  // Instead, we now trust the structural parser and only fix what it found.
  // ===== BUILD FIX LIST =====
  const fixList: {offset: number, scale: number}[] = [];
  for (const off of miniNumberOffsets) {
    if (off + 1 < proofBytes.length) {
      const len = proofBytes[off + 1];
      if (len === 0) {
        const scale = proofBytes[off];
        fixList.push({offset: off, scale});
      }
    }
  }
  
  if (fixList.length === 0) {
    return proofBytes;
  }
  
  // ===== APPLY FIXES =====
  // Rebuild byte array, inserting 0x00 data byte after each len=0
  const result: number[] = [];
  let srcPos = 0;
  
  fixList.sort((a, b) => a.offset - b.offset);
  
  for (const fix of fixList) {
    // Copy bytes up to and including the scale byte
    while (srcPos <= fix.offset) {
      result.push(proofBytes[srcPos++]);
    }
    // Now srcPos is at len byte (which is 0), replace with len=1 and add data=0x00
    result.push(1);  // len = 1
    result.push(0);  // data = 0x00
    srcPos++;  // Skip the original len=0 byte
  }
  
  // Copy remaining bytes
  while (srcPos < proofBytes.length) {
    result.push(proofBytes[srcPos++]);
  }
  
  TxSerializeLogger.debug('CoinProof fixes applied', { index, fixes: fixList.length, originalSize: proofBytes.length, newSize: result.length });
  return new Uint8Array(result);
}

// REMOVED: Local writeMMREntryNumber, writeMiniData, writeHashToStream, writeMiniByte
// Now imported from Streamable.ts (canonical implementation with 43 parity tests)

/**
 * Java-compatible StateVariable type constants.
 * From StateVariable.java:
 *   STATETYPE_HEX = 1
 *   STATETYPE_NUMBER = 2
 *   STATETYPE_STRING = 4
 *   STATETYPE_BOOL = 8
 */
const STATETYPE_HEX = 1;
const STATETYPE_NUMBER = 2;
const STATETYPE_STRING = 4;
const STATETYPE_BOOL = 8;

/**
 * Serialize a StateVariable matching Java's StateVariable.writeDataStream().
 * 
 * JAVA FORMAT:
 *   1. port (MiniByte - 1 byte, 0-255)
 *   2. type (MiniByte - 1 byte: HEX=1, NUMBER=2, STRING=4, BOOL=8)
 *   3. data (format depends on type):
 *      - BOOL: MiniByte (1 byte: 0 or 1)
 *      - HEX: MiniData (4-byte length + data)
 *      - NUMBER: MiniNumber (1-byte scale + 1-byte len + data) 
 *      - STRING: MiniString (4-byte length + UTF-8 bytes with brackets)
 * 
 * UNIFIED (2026-01-20): Now encodes from high-level value internally.
 * No pre-encoding required - matches WitnessSerializer.encodeStateValue().
 */
function serializeStateVariable(sv: StateVariable): Uint8Array {
  if (sv.port < 0 || sv.port > 255) {
    throw new Error(`StateVariable port must be 0-255, got ${sv.port}`);
  }
  
  const portByte = new Uint8Array([sv.port]);
  
  let typeByte: Uint8Array;
  let dataBytes: Uint8Array;
  
  switch (sv.type) {
    case 'bool':
      typeByte = new Uint8Array([STATETYPE_BOOL]);
      // Encode boolean value to MiniByte (1 byte: 0 or 1)
      if (typeof sv.value === 'boolean') {
        dataBytes = new Uint8Array([sv.value ? 1 : 0]);
      } else if (typeof sv.value === 'string') {
        dataBytes = new Uint8Array([sv.value.toUpperCase() === 'TRUE' ? 1 : 0]);
      } else {
        throw new Error(`Invalid bool StateVariable value: ${sv.value}`);
      }
      break;
      
    case 'number':
      typeByte = new Uint8Array([STATETYPE_NUMBER]);
      // Encode number value to MiniNumber (scale + len + data)
      if (typeof sv.value === 'bigint') {
        dataBytes = writeMiniNumber(sv.value);
      } else if (typeof sv.value === 'string') {
        dataBytes = writeMiniNumber(BigInt(sv.value));
      } else {
        throw new Error(`Invalid number StateVariable value: ${sv.value}`);
      }
      break;
      
    case 'hex':
      typeByte = new Uint8Array([STATETYPE_HEX]);
      // Encode hex value to MiniData (4-byte length + raw bytes)
      // Java normalizes Mx addresses to 0x, we do the same
      if (typeof sv.value === 'string') {
        // Normalize Mx addresses to 0x hex, also ensures 0x prefix
        const normalizedHex = normalizeAddressToHex(sv.value);
        dataBytes = writeMiniData(hexToBytes(normalizedHex));
      } else if (sv.value instanceof Uint8Array) {
        dataBytes = writeMiniData(sv.value);
      } else {
        throw new Error(`Invalid hex StateVariable value: ${sv.value}`);
      }
      break;
      
    case 'string':
      typeByte = new Uint8Array([STATETYPE_STRING]);
      // Encode string value to MiniString (4-byte length + UTF-8 with brackets)
      // Java expects bracketed strings: [my string]
      if (typeof sv.value === 'string') {
        // Add brackets if not already present
        let bracketedValue = sv.value;
        if (!sv.value.startsWith('[') || !sv.value.endsWith(']')) {
          bracketedValue = `[${sv.value}]`;
        }
        const utf8Bytes = new TextEncoder().encode(bracketedValue);
        dataBytes = writeMiniData(utf8Bytes);
      } else {
        throw new Error(`Invalid string StateVariable value: ${sv.value}`);
      }
      break;
      
    default:
      throw new Error(`Unknown StateVariable type: ${(sv as any).type}`);
  }
  
  return concat(portByte, typeByte, dataBytes);
}

function serializeToken(token: MinimaToken): Uint8Array {
  // Java Token.writeDataStream() order: coinId, script, scale, totalAmount, name, created
  const parts: Uint8Array[] = [];
  parts.push(writeHashToStream(token.coinId));
  parts.push(writeMiniData(token.script));
  parts.push(writeMiniNumber(BigInt(token.scale)));
  parts.push(writeMiniNumber(token.totalAmount, 0));
  parts.push(writeMiniData(token.name));
  parts.push(writeMiniNumber(token.created ?? 0n));
  return concat(...parts);
}

/**
 * Serialize a Coin per Minima's Java Coin.writeDataStream().
 * 
 * Order:
 *   1. coinId (writeHashToStream - 4-byte length + hash)
 *   2. address (writeHashToStream - 4-byte length + hash)
 *   3. amount (MiniNumber with natural BigDecimal scale from API decimal string)
 *   4. tokenId (MiniData - 4-byte length + data, NOT writeHashToStream!)
 *   5. storeState (MiniByte)
 *   6. mmrEntryNumber (MiniNumber)
 *   7. spent (MiniByte)
 *   8. blockCreated (MiniNumber)
 *   9. state count (MiniNumber) + each state var
 *   10. hasToken (MiniByte) + token if present
 * 
 * CRITICAL (2026-01-20): 
 *   - Amount uses NATURAL BigDecimal scale from the API decimal string!
 *   - "36000" → scale=0, unscaled=36000 → `00 03 00 8C A0`
 *   - "0.0001" → scale=4, unscaled=1 → `04 01 01`
 *   - tokenId uses MiniData encoding, not writeHashToStream
 *   - For native MINIMA, tokenId is 0x00 (1 byte), encoded as: 00 00 00 01 00
 */
function serializeCoin(coin: MinimaCoin, coinIndex: number, isInput: boolean): Uint8Array {
  const coinType = isInput ? 'INPUT' : 'OUTPUT';
  const parts: Uint8Array[] = [];
  
  // DIAGNOSTIC: Log each field for byte-exact comparison
  console.log(`[COIN-SERIALIZE] ─── ${coinType}[${coinIndex}] ───`);
  
  const coinIdBytes = writeHashToStream(coin.coinId);
  console.log(`[COIN-SERIALIZE]   coinId: ${bytesToHex(coinIdBytes)} (${coinIdBytes.length}B, raw: ${bytesToHex(coin.coinId)})`);
  parts.push(coinIdBytes);
  
  const addressBytes = writeHashToStream(coin.address);
  console.log(`[COIN-SERIALIZE]   address: ${bytesToHex(addressBytes)} (${addressBytes.length}B)`);
  parts.push(addressBytes);
  
  let amountBytes: Uint8Array;
  if (coin.rawAmountBytes && coin.rawAmountBytes.length > 0) {
    amountBytes = coin.rawAmountBytes;
    console.log(`[COIN-SERIALIZE]   amount (RAW): ${bytesToHex(amountBytes)} (${amountBytes.length}B) [extracted from CoinProof]`);
  } else {
    const parsedAmount = parseDecimalToMiniNumber(coin.amount);
    amountBytes = encodeParsedMiniNumber(parsedAmount);
    console.log(`[COIN-SERIALIZE]   amount (COMPUTED): ${bytesToHex(amountBytes)} (${amountBytes.length}B) [scale=${parsedAmount.scale}, unscaled=${parsedAmount.unscaledValue}]`);
  }
  parts.push(amountBytes);
  
  const tokenIdBytes = writeMiniData(coin.tokenId);
  console.log(`[COIN-SERIALIZE]   tokenId: ${bytesToHex(tokenIdBytes)} (${tokenIdBytes.length}B)`);
  parts.push(tokenIdBytes);
  
  const storeStateBytes = writeMiniByte(coin.storeState);
  console.log(`[COIN-SERIALIZE]   storeState: ${bytesToHex(storeStateBytes)} (${storeStateBytes.length}B)`);
  parts.push(storeStateBytes);
  
  // MMREntryNumber: use raw bytes if available for byte-exact match
  let mmrBytes: Uint8Array;
  if (coin.rawMmrEntryBytes && coin.rawMmrEntryBytes.length > 0) {
    mmrBytes = coin.rawMmrEntryBytes;
    console.log(`[COIN-SERIALIZE]   mmrEntry (RAW): ${bytesToHex(mmrBytes)} (${mmrBytes.length}B) [extracted from CoinProof]`);
  } else {
    mmrBytes = writeMMREntryNumber(coin.mmrEntryNumber);
    console.log(`[COIN-SERIALIZE]   mmrEntry (COMPUTED): ${bytesToHex(mmrBytes)} (${mmrBytes.length}B) [value=${coin.mmrEntryNumber}]`);
  }
  parts.push(mmrBytes);
  
  const spentBytes = writeMiniByte(coin.spent);
  console.log(`[COIN-SERIALIZE]   spent: ${bytesToHex(spentBytes)} (${spentBytes.length}B)`);
  parts.push(spentBytes);
  
  // blockCreated: use raw bytes if available for byte-exact match
  let createdBytes: Uint8Array;
  if (coin.rawBlockCreatedBytes && coin.rawBlockCreatedBytes.length > 0) {
    createdBytes = coin.rawBlockCreatedBytes;
    console.log(`[COIN-SERIALIZE]   created (RAW): ${bytesToHex(createdBytes)} (${createdBytes.length}B) [extracted from CoinProof]`);
  } else {
    createdBytes = writeMiniNumber(coin.created);
    console.log(`[COIN-SERIALIZE]   created (COMPUTED): ${bytesToHex(createdBytes)} (${createdBytes.length}B) [value=${coin.created}]`);
  }
  parts.push(createdBytes);
  
  const stateCountBytes = writeMiniNumber(BigInt(coin.state.length));
  console.log(`[COIN-SERIALIZE]   stateCount: ${bytesToHex(stateCountBytes)} (${stateCountBytes.length}B)`);
  parts.push(stateCountBytes);
  
  // State variables: handle both high-level StateVariable and raw RawStateVariable
  for (const sv of coin.state) {
    let svBytes: Uint8Array;
    if ('rawData' in sv) {
      // RawStateVariable from CoinProof - use pre-serialized bytes
      const raw = sv as RawStateVariable;
      const portByte = new Uint8Array([raw.port]);
      const typeByte = new Uint8Array([raw.type]);
      svBytes = concat(portByte, typeByte, raw.rawData);
      console.log(`[COIN-SERIALIZE]   stateVar (RAW): ${bytesToHex(svBytes)} (${svBytes.length}B) [port=${raw.port}, type=${raw.type}]`);
    } else {
      // High-level StateVariable - serialize normally
      svBytes = serializeStateVariable(sv as StateVariable);
      console.log(`[COIN-SERIALIZE]   stateVar: ${bytesToHex(svBytes)} (${svBytes.length}B)`);
    }
    parts.push(svBytes);
  }
  
  if (coin.rawTokenData && coin.rawTokenData.length > 0) {
    // Byte-exact token bytes from CoinProof — Java requires hasToken=1 for custom token coins.
    // Writing the 5-field token metadata verbatim prevents NullPointerException in txnimport.
    parts.push(writeMiniByte(true));
    parts.push(coin.rawTokenData);
    console.log(`[COIN-SERIALIZE]   hasToken: 01 (raw token ${coin.rawTokenData.length}B from CoinProof)`);
  } else if (coin.token) {
    parts.push(writeMiniByte(true));
    parts.push(serializeToken(coin.token));
    console.log(`[COIN-SERIALIZE]   hasToken: 01 (true)`);
  } else {
    const noTokenByte = writeMiniByte(false);
    console.log(`[COIN-SERIALIZE]   hasToken: ${bytesToHex(noTokenByte)} (false)`);
    parts.push(noTokenByte);
  }
  
  const result = concat(...parts);
  console.log(`[COIN-SERIALIZE]   TOTAL: ${result.length}B`);
  
  TxSerializeLogger.trace(`${coinType}[${coinIndex}]`, {
    coinId: bytesToHex(coinIdBytes).slice(0, 16),
    address: bytesToHex(addressBytes).slice(0, 16),
    amount: bytesToHex(amountBytes),
    tokenId: bytesToHex(tokenIdBytes),
    mmr: coin.mmrEntryNumber.toString(),
    stateCount: coin.state.length,
    totalBytes: result.length
  });
  
  return result;
}

export function serializeTransaction(tx: MinimaTransaction): Uint8Array {
  TxSerializeLogger.debug(`Serializing transaction`, {
    build: BUILD_VERSION,
    inputs: tx.inputs.length,
    outputs: tx.outputs.length,
    state: tx.state.length
  });
  
  const parts: Uint8Array[] = [];
  let runningOffset = 0;
  
  // DIAGNOSTIC: Log each field for byte-exact comparison with Java
  console.log('[TX-SERIALIZE] ═══════════════════════════════════════════════════════════════');
  console.log('[TX-SERIALIZE] FULL TRANSACTION SERIALIZATION BREAKDOWN (for Java parity check)');
  console.log('[TX-SERIALIZE] ═══════════════════════════════════════════════════════════════');
  
  const inputCountBytes = writeMiniNumber(BigInt(tx.inputs.length));
  console.log(`[TX-SERIALIZE] inputCount: ${bytesToHex(inputCountBytes)} (${inputCountBytes.length}B) @ offset ${runningOffset}`);
  parts.push(inputCountBytes);
  runningOffset += inputCountBytes.length;
  
  for (let i = 0; i < tx.inputs.length; i++) {
    const coinBytes = serializeCoin(tx.inputs[i], i, true);
    console.log(`[TX-SERIALIZE] INPUT[${i}]: ${coinBytes.length}B @ offset ${runningOffset}`);
    console.log(`[TX-SERIALIZE]   Full hex: ${bytesToHex(coinBytes)}`);
    parts.push(coinBytes);
    runningOffset += coinBytes.length;
  }
  
  const outputCountBytes = writeMiniNumber(BigInt(tx.outputs.length));
  console.log(`[TX-SERIALIZE] outputCount: ${bytesToHex(outputCountBytes)} (${outputCountBytes.length}B) @ offset ${runningOffset}`);
  parts.push(outputCountBytes);
  runningOffset += outputCountBytes.length;
  
  for (let i = 0; i < tx.outputs.length; i++) {
    const coinBytes = serializeCoin(tx.outputs[i], i, false);
    console.log(`[TX-SERIALIZE] OUTPUT[${i}]: ${coinBytes.length}B @ offset ${runningOffset}`);
    console.log(`[TX-SERIALIZE]   Full hex: ${bytesToHex(coinBytes)}`);
    parts.push(coinBytes);
    runningOffset += coinBytes.length;
  }
  
  const stateCountBytes = writeMiniNumber(BigInt(tx.state.length));
  console.log(`[TX-SERIALIZE] stateCount: ${bytesToHex(stateCountBytes)} (${stateCountBytes.length}B) @ offset ${runningOffset}`);
  parts.push(stateCountBytes);
  runningOffset += stateCountBytes.length;
  
  for (const sv of tx.state) {
    const svBytes = serializeStateVariable(sv);
    console.log(`[TX-SERIALIZE] StateVar: ${bytesToHex(svBytes)} (${svBytes.length}B)`);
    parts.push(svBytes);
    runningOffset += svBytes.length;
  }
  
  const linkHashBytes = writeHashToStream(tx.linkHash);
  console.log(`[TX-SERIALIZE] linkHash: ${bytesToHex(linkHashBytes)} (${linkHashBytes.length}B) @ offset ${runningOffset}`);
  parts.push(linkHashBytes);
  runningOffset += linkHashBytes.length;
  
  const result = concat(...parts);
  
  console.log('[TX-SERIALIZE] ───────────────────────────────────────────────────────────────');
  console.log(`[TX-SERIALIZE] TOTAL: ${result.length} bytes`);
  console.log(`[TX-SERIALIZE] FULL TX HEX: ${bytesToHex(result)}`);
  console.log(`[TX-SERIALIZE] SHA3-256: ${bytesToHex(new Uint8Array(sha3_256.arrayBuffer(result)))}`);
  console.log('[TX-SERIALIZE] ═══════════════════════════════════════════════════════════════');
  
  TxSerializeLogger.info(`Transaction serialized`, {
    totalBytes: result.length,
    linkHash: bytesToHex(linkHashBytes).slice(0, 16)
  });
  
  return result;
}

export function computeTransactionDigest(tx: MinimaTransaction): Uint8Array {
  const serialized = serializeTransaction(tx);
  return new Uint8Array(sha3_256.arrayBuffer(serialized));
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
 * Without this, Totem signs a different digest than what the node verifies against,
 * causing allsignaturesvalid=false on every transaction.
 */
export function precomputeTransactionCoinID(tx: MinimaTransaction): void {
  if (tx.inputs.length === 0) return;

  const baseCoinId = tx.inputs[0].coinId;

  if (baseCoinId.length < 2) {
    throw new Error(
      `Cannot precompute output coinIDs: input[0].coinId is ${baseCoinId.length} byte(s) ` +
      `(placeholder?). Real coinId from CoinProof required for signing.`
    );
  }

  for (let i = 0; i < tx.outputs.length; i++) {
    const baseCoinIdStream = writeMiniData(baseCoinId);
    const outputIndexStream = writeMiniNumber(BigInt(i));
    const concat = streamableConcat(baseCoinIdStream, outputIndexStream);
    const coinId = new Uint8Array(sha3_256.arrayBuffer(concat));
    tx.outputs[i].coinId = coinId;
  }
}

/**
 * DIAGNOSTIC: Generate comprehensive byte-level analysis of transaction serialization.
 * Use this to compare with Java's txnexport output for parity verification.
 * 
 * This outputs detailed breakdowns of each field's serialization to help identify
 * exactly where byte mismatches occur between TypeScript and Java.
 */
export function diagnosticTransactionDump(tx: MinimaTransaction): {
  summary: string;
  digest: string;
  totalBytes: number;
  breakdown: { field: string; offset: number; bytes: string; length: number }[];
} {
  const breakdown: { field: string; offset: number; bytes: string; length: number }[] = [];
  let offset = 0;
  
  const addField = (field: string, bytes: Uint8Array) => {
    breakdown.push({
      field,
      offset,
      bytes: bytesToHex(bytes),
      length: bytes.length
    });
    offset += bytes.length;
    return bytes;
  };
  
  const parts: Uint8Array[] = [];
  
  // Input count
  const inputCount = writeMiniNumber(BigInt(tx.inputs.length));
  parts.push(addField('inputCount', inputCount));
  
  // Each input coin
  for (let i = 0; i < tx.inputs.length; i++) {
    const coin = tx.inputs[i];
    
    const coinId = writeHashToStream(coin.coinId);
    parts.push(addField(`input[${i}].coinId`, coinId));
    
    const address = writeHashToStream(coin.address);
    parts.push(addField(`input[${i}].address`, address));
    
    let amount: Uint8Array;
    if (coin.rawAmountBytes && coin.rawAmountBytes.length > 0) {
      amount = coin.rawAmountBytes;
      parts.push(addField(`input[${i}].amount(RAW)`, amount));
    } else {
      const parsed = parseDecimalToMiniNumber(coin.amount);
      amount = writeMiniNumber(parsed.unscaledValue, parsed.scale);
      parts.push(addField(`input[${i}].amount(COMPUTED:scale=${parsed.scale})`, amount));
    }
    
    const tokenId = writeMiniData(coin.tokenId);
    parts.push(addField(`input[${i}].tokenId`, tokenId));
    
    const storeState = writeMiniByte(coin.storeState);
    parts.push(addField(`input[${i}].storeState`, storeState));
    
    let mmrEntry: Uint8Array;
    if (coin.rawMmrEntryBytes && coin.rawMmrEntryBytes.length > 0) {
      mmrEntry = coin.rawMmrEntryBytes;
      parts.push(addField(`input[${i}].mmrEntry(RAW)`, mmrEntry));
    } else {
      mmrEntry = writeMMREntryNumber(coin.mmrEntryNumber);
      parts.push(addField(`input[${i}].mmrEntry(COMPUTED)`, mmrEntry));
    }
    
    const spent = writeMiniByte(coin.spent);
    parts.push(addField(`input[${i}].spent`, spent));
    
    let created: Uint8Array;
    if (coin.rawBlockCreatedBytes && coin.rawBlockCreatedBytes.length > 0) {
      created = coin.rawBlockCreatedBytes;
      parts.push(addField(`input[${i}].created(RAW)`, created));
    } else {
      created = writeMiniNumber(coin.created);
      parts.push(addField(`input[${i}].created(COMPUTED)`, created));
    }
    
    const stateCount = writeMiniNumber(BigInt(coin.state.length));
    parts.push(addField(`input[${i}].stateCount`, stateCount));
    
    for (let s = 0; s < coin.state.length; s++) {
      const sv = coin.state[s];
      if ('rawData' in sv) {
        const raw = sv as { port: number; type: number; rawData: Uint8Array };
        const svBytes = concat(new Uint8Array([raw.port, raw.type]), raw.rawData);
        parts.push(addField(`input[${i}].state[${s}](RAW)`, svBytes));
      }
    }
    
    const hasToken = writeMiniByte(!!coin.token);
    parts.push(addField(`input[${i}].hasToken`, hasToken));
  }
  
  // Output count
  const outputCount = writeMiniNumber(BigInt(tx.outputs.length));
  parts.push(addField('outputCount', outputCount));
  
  // Each output coin (abbreviated for diagnostic purposes)
  for (let i = 0; i < tx.outputs.length; i++) {
    const coin = tx.outputs[i];
    
    const coinId = writeHashToStream(coin.coinId);
    parts.push(addField(`output[${i}].coinId`, coinId));
    
    const address = writeHashToStream(coin.address);
    parts.push(addField(`output[${i}].address`, address));
    
    const parsed = parseDecimalToMiniNumber(coin.amount);
    const amount = writeMiniNumber(parsed.unscaledValue, parsed.scale);
    parts.push(addField(`output[${i}].amount(scale=${parsed.scale},unscaled=${parsed.unscaledValue})`, amount));
    
    const tokenId = writeMiniData(coin.tokenId);
    parts.push(addField(`output[${i}].tokenId`, tokenId));
    
    const storeState = writeMiniByte(coin.storeState);
    parts.push(addField(`output[${i}].storeState`, storeState));
    
    const mmrEntry = writeMMREntryNumber(coin.mmrEntryNumber);
    parts.push(addField(`output[${i}].mmrEntry`, mmrEntry));
    
    const spent = writeMiniByte(coin.spent);
    parts.push(addField(`output[${i}].spent`, spent));
    
    const created = writeMiniNumber(coin.created);
    parts.push(addField(`output[${i}].created`, created));
    
    const stateCount = writeMiniNumber(BigInt(coin.state.length));
    parts.push(addField(`output[${i}].stateCount`, stateCount));
    
    const hasToken = writeMiniByte(!!coin.token);
    parts.push(addField(`output[${i}].hasToken`, hasToken));
  }
  
  // State count
  const stateCount = writeMiniNumber(BigInt(tx.state.length));
  parts.push(addField('stateCount', stateCount));
  
  // LinkHash
  const linkHash = writeHashToStream(tx.linkHash);
  parts.push(addField('linkHash', linkHash));
  
  const allBytes = concat(...parts);
  const digest = new Uint8Array(sha3_256.arrayBuffer(allBytes));
  
  const summary = `Transaction: ${tx.inputs.length} inputs, ${tx.outputs.length} outputs, ${allBytes.length} bytes, digest=${bytesToHex(digest)}`;
  
  return {
    summary,
    digest: bytesToHex(digest),
    totalBytes: allBytes.length,
    breakdown
  };
}

export function parseDecimalToBaseUnits(decimal: string): bigint {
  if (!decimal || decimal === '0') return 0n;
  
  const [whole, frac = ''] = decimal.split('.');
  const paddedFrac = frac.slice(0, MINIMA_DECIMALS).padEnd(MINIMA_DECIMALS, '0');
  const combined = (whole || '0') + paddedFrac;
  return BigInt(combined.replace(/^0+/, '') || '0');
}

export function formatBaseUnitsToDecimal(baseUnits: bigint): string {
  const str = baseUnits.toString().padStart(MINIMA_DECIMALS + 1, '0');
  const whole = str.slice(0, -MINIMA_DECIMALS) || '0';
  const frac = str.slice(-MINIMA_DECIMALS).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

/**
 * Convert SpendableCoinInput to MinimaCoin format.
 * 
 * If input.rawAmountBytes is provided (extracted from CoinProof), it will be used
 * for byte-exact serialization matching the blockchain. Otherwise, the decimal 
 * amount string is parsed at serialization time.
 */
function convertInputCoin(input: SpendableCoinInput): MinimaCoin {
  TxBuildLogger.trace('Converting input coin', {
    address: input.address?.substring(0, 20),
    coinId: input.coinId?.substring(0, 16),
    hasRawAmountBytes: !!input.rawAmountBytes,
    hasCoinProofData: !!input.coinProofData
  });
  
  // If we have complete CoinProofData, use it for byte-exact serialization
  // This is CRITICAL for matching Java's transaction ID computation
  if (input.coinProofData) {
    const cpd = input.coinProofData;
    TxBuildLogger.trace('Using CoinProofData for byte-exact input coin', {
      mmrEntryNumber: cpd.mmrEntryNumber.toString(),
      blockCreated: cpd.blockCreated.toString(),
      storeState: cpd.storeState,
      stateCount: cpd.state.length
    });
    
    return {
      coinId: cpd.coinId,
      address: cpd.address,
      amount: input.amount || '0',  // Fallback decimal string
      tokenId: cpd.tokenId,
      token: null,
      storeState: cpd.storeState,
      state: cpd.state,
      mmrEntryNumber: cpd.mmrEntryNumber,
      spent: cpd.spent,
      created: cpd.blockCreated,
      rawAmountBytes: cpd.rawAmountBytes,
      rawMmrEntryBytes: cpd.rawMmrEntryBytes,
      rawBlockCreatedBytes: cpd.rawBlockCreatedBytes,
      rawTokenData: cpd.rawTokenData
    };
  }
  
  // Fallback: use basic fields with hardcoded defaults
  // NOTE: This is EXPECTED for preview builds in TransactionAssembler.
  // Preview builds run before lease acquisition, so CoinProofData is unavailable.
  // The actual signing flow (WOTS_SEND handler) rebuilds the transaction WITH
  // CoinProofData from the server, ensuring byte-exact serialization for signing.
  // The preview txnid may differ from final txnid - this is by design.
  TxBuildLogger.debug('[PREVIEW MODE] No CoinProofData - using defaults (actual signing will fetch real data)');
  
  const normalizedAddress = normalizeAddressToHex(input.address);
  
  const addressBytes = hexToBytes(normalizedAddress);
  const paddedAddress = new Uint8Array(32);
  paddedAddress.set(addressBytes.slice(0, 32));
  
  const coinIdBytes = hexToBytes(input.coinId);
  const paddedCoinId = new Uint8Array(32);
  paddedCoinId.set(coinIdBytes.slice(0, 32));
  
  // TokenId should preserve original length (not padded to 32)
  // For native MINIMA, tokenId is 0x00 (1 byte)
  // For custom tokens, tokenId is a 32-byte hash
  const tokenIdBytes = hexToBytes(input.tokenId || '0x00');
  
  // Amount stays as the original decimal string for serialization
  // parseDecimalToMiniNumber will extract scale and unscaledValue at serialization time
  const amountString = input.amount || '0';
  
  return {
    coinId: paddedCoinId,
    address: paddedAddress,
    amount: amountString,  // Original decimal string for correct scale serialization
    tokenId: tokenIdBytes,  // Preserve original length
    token: null,
    storeState: false,
    state: [],
    mmrEntryNumber: 0n,
    spent: false,
    created: 0n,
    rawAmountBytes: input.rawAmountBytes  // Pass through for byte-exact serialization
  };
}

// Native MINIMA tokenId is 0x00 (1 byte, not 32)
const MINIMA_TOKEN_ID = new Uint8Array([0x00]);

// CRITICAL: Java's COINID_OUTPUT is 0x00 (1 byte), NOT 32 zero bytes!
// Output coins must use this 1-byte coinId to match Java's Transaction.writeDataStream()
// See Coin.java line 24: public static final MiniData COINID_OUTPUT = new MiniData("0x00");
const COINID_OUTPUT = new Uint8Array([0x00]);

function createOutputCoin(
  address: Uint8Array,
  amount: string,  // Decimal string for correct scale serialization
  tokenId: Uint8Array = MINIMA_TOKEN_ID,
  storeState: boolean = true,  // true for recipient output, false for change output (matches Java)
  rawTokenData?: Uint8Array    // Token bytes from input CoinProof; undefined for native Minima
): MinimaCoin {
  // Java's Coin constructor: new Coin(address, amount, tokenId) → storeState=true (default)
  //                          new Coin(address, amount, tokenId, false) → storeState=false (change)
  // Custom token output coins must carry hasToken=1 + embedded Token bytes so Java can read
  // the token's scale value during the basic conservation check (mToken must not be null).
  // rawTokenData comes verbatim from the input coin's CoinProof extraction.
  // Native Minima sends leave rawTokenData=undefined → hasToken=0 in serialization.
  return {
    coinId: COINID_OUTPUT,  // Java's COINID_OUTPUT is 0x00 (1 byte), NOT 32 zeros!
    address: address,
    amount: amount,  // Decimal string preserves natural scale for serialization
    tokenId: tokenId,
    token: null,
    storeState,
    state: [],
    mmrEntryNumber: 0n,
    spent: false,
    created: 0n,
    rawTokenData
  };
}

/**
 * Parameters for building a transaction.
 * CRITICAL: All amounts must be in BASE UNITS (44 decimal precision as string).
 * Convert decimal amounts to base units BEFORE calling buildTransaction.
 */
export interface BuildTransactionParams {
  inputs: SpendableCoinInput[];  // amounts in BASE UNITS
  recipientAddress: string;
  amount: string;  // BASE UNITS as string (NOT decimal)
  tokenId?: string;
  changeAddress?: string;
}

/**
 * Legacy WOTS signature data structure (deprecated)
 * Kept for backwards compatibility with older transaction flows
 */
export interface WotsSignatureDataLegacy {
  l1: number;
  l2: number;
  l3: number;
  l1Proof: string[];
  l2Proof: string[];
  l3Proof: string[];
  rootPublicKey: string;
}

// Import SDK types and functions for MMR serialization (CONSOLIDATION 2026-01-18)
import type { MMRProof, MMRProofChunk } from '../../../../totem-sdk/packages/core/src/mmr';
import { serializeMMRProof as serializeMMRProofSDK } from '../../../../totem-sdk/packages/core/src/mmr';

/**
 * TreeKey-based SignatureProof data for Minima-compatible transactions
 * 
 * Uses the new TreeKey architecture where:
 * - leafPublicKey: The 32-byte WOTS public key DIGEST (SHA3 of all chain outputs)
 * - signature: The WOTS signature bytes (34 × 32 = 1088 bytes for w=8, L=34)
 * - mmrProof: Proof linking leaf → address MMR root (the SIGNEDBY key)
 * - addressPublicKey: The address's public key (level-1 TreeKeyNode MMR root)
 * 
 * Java-compatible: matches Minima's SignatureProof.java where mPublicKey is the
 * 32-byte digest returned by Winternitz.getPublicKey()
 */
export interface TreeKeySignatureProof {
  leafPublicKey: Uint8Array; // 32 bytes - WOTS public key DIGEST (matches Java)
  signature: Uint8Array; // 1088 bytes - WOTS signature (34 chains × 32 bytes)
  mmrProof: MMRProofChunk[]; // SDK format - Proof chunks linking leaf to address root
  addressPublicKey: Uint8Array; // 32 bytes - the address MMR root (for ScriptProof)
}

/**
 * Hierarchical SignatureProof in hex format (for transport/serialization)
 */
export interface SignatureProofHex {
  leafPubkey: string;   // 32-byte WOTS public key DIGEST as hex (matches Java)
  signature: string;    // 1088-byte WOTS signature as hex (L×32 = 34×32 bytes)
  mmrProof: string;     // Serialized MMR proof as hex
}

/**
 * WOTS signature data for transaction witness
 * Supports legacy, TreeKey, and new hierarchical architectures
 */
export interface WotsSignatureData {
  // Per-address TreeKey indices (2026-02)
  // addressIndex = which HD address (0-63), l1/l2 = indices within per-address TreeKey
  addressIndex?: number;
  l1?: number;
  l2?: number;
  
  // Per-address TreeKey root (32 bytes) - matches SIGNEDBY in address script
  rootPublicKey: string;
  
  // Per-address TreeKey hierarchical format (REQUIRED since 2026-02)
  // Contains 2 SignatureProofs: Root→L1, L1→DATA
  hierarchical: boolean;
  proofs: SignatureProofHex[];
}

/**
 * Per-input script metadata for multi-address transactions.
 * 
 * Per-address TreeKey architecture (2026-02): Each HD address has its own
 * independent TreeKey with its own MMR root public key. The rootPublicKey here
 * is the per-address TreeKey root that matches the SIGNEDBY in the address script.
 * 
 * Transactions spending coins from multiple addresses emit one ScriptProof
 * per unique address based on this metadata.
 */
export interface InputScriptInfo {
  /** The address (0x hex) of the input coin */
  address: string;
  /** The per-address TreeKey root public key (0x hex, 32 bytes) that matches SIGNEDBY in address script */
  rootPublicKey: string;
}

export interface TxPoWBuildResult extends TransactionBuildResult {
  txpowHex: string;
}

/**
 * Serialize an MMRProof using SDK canonical implementation.
 * Uses serializeMMRProofSDK imported at top of file (CONSOLIDATION 2026-01-18)
 */
function serializeMMRProof(proof: MMRProof): Uint8Array {
  TxSerializeLogger.trace(`MMRProof Using SDK serialization, chunks: ${proof.chunks.length}`);
  return serializeMMRProofSDK(proof, 0n);
}

/**
 * Serialize a SignatureProof per Minima's SignatureProof.writeDataStream()
 * 
 * Order:
 *   1. publicKey (MiniData) - the leaf public key (from TreeKeyNode)
 *   2. signature (MiniData) - the WOTS signature bytes
 *   3. proof (MMRProof) - proof from leaf to the address MMR root
 * 
 * For TreeKey architecture:
 * - publicKey is the Winternitz leaf key used for signing
 * - signature is the WOTS signature
 * - proof contains MMR siblings to verify leaf → address root
 */
function serializeSignatureProof(
  publicKey: Uint8Array,
  signature: Uint8Array,
  mmrProof: MMRProof = { chunks: [] }
): Uint8Array {
  const parts: Uint8Array[] = [];
  
  const pubKeyBytes = writeMiniData(publicKey);
  parts.push(pubKeyBytes);
  TxSerializeLogger.trace(`SignatureProof publicKey: ${pubKeyBytes.length} bytes (key=${publicKey.length} bytes)`);
  
  const sigBytes = writeMiniData(signature);
  parts.push(sigBytes);
  TxSerializeLogger.trace(`SignatureProof signature: ${sigBytes.length} bytes (sig=${signature.length} bytes)`);
  
  parts.push(serializeMMRProof(mmrProof));
  
  const result = concat(...parts);
  TxSerializeLogger.trace(`SignatureProof TOTAL: ${result.length} bytes`);
  return result;
}

/**
 * Serialize a SignatureProof from pre-serialized byte arrays
 * 
 * Used by hierarchical TreeKey format where MMR proof is already serialized
 * (coming from the SDK's serializeMMRProof output)
 * 
 * @param publicKey - The leaf public key bytes
 * @param signature - The WOTS signature bytes
 * @param mmrProofBytes - Pre-serialized MMR proof bytes
 */
function serializeSignatureProofFromBytes(
  publicKey: Uint8Array,
  signature: Uint8Array,
  mmrProofBytes: Uint8Array
): Uint8Array {
  const parts: Uint8Array[] = [];
  
  const pubKeyBytes = writeMiniData(publicKey);
  parts.push(pubKeyBytes);
  TxSerializeLogger.trace(`SignatureProof publicKey: ${pubKeyBytes.length} bytes (key=${publicKey.length} bytes)`);
  
  const sigBytes = writeMiniData(signature);
  parts.push(sigBytes);
  TxSerializeLogger.trace(`SignatureProof signature: ${sigBytes.length} bytes (sig=${signature.length} bytes)`);
  
  // MMR proof is already serialized - just append it
  parts.push(mmrProofBytes);
  TxSerializeLogger.trace(`SignatureProof mmrProof: ${mmrProofBytes.length} bytes (pre-serialized)`);
  
  const result = concat(...parts);
  TxSerializeLogger.trace(`SignatureProof TOTAL: ${result.length} bytes`);
  return result;
}

/**
 * Serialize a Signature per Minima's Signature.writeDataStream()
 * 
 * From Signature.java writeDataStream():
 *   MiniNumber.WriteToStream(zOut, mSignatures.size());
 *   for(SignatureProof sig : mSignatures) {
 *     sig.writeDataStream(zOut);
 *   }
 * 
 * A Signature contains a list of SignatureProofs (for hierarchical trees).
 * For simple WOTS, there's typically one SignatureProof.
 */
function serializeSignature(signatureProofs: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [];
  
  // Inner count: number of SignatureProof objects in this Signature
  const sigProofCountBytes = writeMiniNumber(BigInt(signatureProofs.length));
  parts.push(sigProofCountBytes);
  TxSerializeLogger.trace(`Signature signatureProofCount: ${bytesToHex(sigProofCountBytes)} (${signatureProofs.length} proofs)`);
  
  for (let i = 0; i < signatureProofs.length; i++) {
    TxSerializeLogger.trace(`Signature SignatureProof[${i}]: ${signatureProofs[i].length} bytes`);
    parts.push(signatureProofs[i]);
  }
  
  const result = concat(...parts);
  TxSerializeLogger.trace(`Signature TOTAL: ${result.length} bytes`);
  return result;
}

/**
 * Serialize a Witness per Minima's Witness.writeDataStream()
 * 
 * Order:
 *   1. Signature count (MiniNumber) + each Signature
 *   2. CoinProof count (MiniNumber) + each CoinProof
 *   3. ScriptProof count (MiniNumber) + each ScriptProof
 * 
 * CoinProofs are required for transaction validation - they prove each input coin
 * exists in the MMR tree. These are fetched from the server via coinexport RPC.
 * 
 * ScriptProofs are required for WOTS transactions - they provide the unlock script
 * (e.g., "RETURN SIGNEDBY(0xAddressPubKey)") that Minima uses to verify the transaction.
 * 
 * TREEKEY ARCHITECTURE (2025-01):
 * Each address has a unique public key (level-1 TreeKeyNode MMR root).
 * SignatureProof includes: leaf pubkey + WOTS signature + MMR proof → address root.
 * 
 * For multi-address transactions, inputScripts provides per-address metadata.
 */
function serializeWitness(
  wotsData?: WotsSignatureData, 
  coinProofsHex?: string[],
  inputScripts?: InputScriptInfo[]
): Uint8Array {
  TxSerializeLogger.debug('Serializing witness', { hasWotsData: !!wotsData, coinProofs: coinProofsHex?.length || 0, scripts: inputScripts?.length || 0 });
  const parts: Uint8Array[] = [];
  
  if (wotsData) {
    // Check if using new hierarchical TreeKey format
    if (wotsData.hierarchical && wotsData.proofs && Array.isArray(wotsData.proofs)) {
      // New hierarchical format: 3 SignatureProofs forming parent-child chain
      // This is the correct Minima TreeKey signature structure
      const proofs = wotsData.proofs;
      TxSerializeLogger.trace(`Witness Using HIERARCHICAL TreeKey format with ${proofs.length} signature proofs`);
      
      // Signature count = 1 (the entire TreeSignature is one "Signature" in Minima terms)
      const sigCountBytes = writeMiniNumber(1n);
      parts.push(sigCountBytes);
      TxSerializeLogger.trace(`Witness signatureCount: ${bytesToHex(sigCountBytes)} (1 hierarchical signature)`);
      
      // Per-address TreeKey signing uses setUses(l1*64+l2) + sign() to produce 3 proofs:
      //   proof[0]: Root signs L1 child's public key (Root→L1)
      //   proof[1]: L1 node signs L2 child's public key (L1→L2)
      //   proof[2]: L2 node signs the actual transaction digest (L2→DATA)
      // This matches Minima's Java TreeKey.sign() exactly for depth=3 TreeKeys.
      
      // Each proof in the chain: leafPubkey + signature + mmrProof
      // CRITICAL FIX (January 2026): leafPubkey is 32-byte WOTS public key DIGEST!
      // Java's Winternitz.getPublicKey() returns SHA3-256(full_1088_byte_key) = 32 bytes
      // BouncyCastle's WinternitzOTSignature.getPublicKey() hashes the full key before returning
      const EXPECTED_WOTS_PUBKEY_SIZE = 32; // 32-byte SHA3-256 digest of full L×32 key
      const EXPECTED_WOTS_SIGNATURE_SIZE = 34 * 32; // L=34 chains × 32 bytes = 1088 bytes
      
      const signatureProofParts: Uint8Array[] = [];
      for (let i = 0; i < proofs.length; i++) {
        const proof = proofs[i];
        const leafPk = hexToBytes(proof.leafPubkey);
        const sig = hexToBytes(proof.signature);
        const mmrProof = hexToBytes(proof.mmrProof);
        
        TxSerializeLogger.trace(`Witness HierarchicalProof[${i}]: leafPk=${leafPk.length}B, sig=${sig.length}B, mmr=${mmrProof.length}B`);
        
        // RUNTIME VALIDATION: Fail fast if public key is wrong size
        if (leafPk.length !== EXPECTED_WOTS_PUBKEY_SIZE) {
          const errMsg = `CRITICAL: proof[${i}].leafPubkey is ${leafPk.length} bytes, expected ${EXPECTED_WOTS_PUBKEY_SIZE} bytes (32-byte WOTS public key digest)`;
          TxSerializeLogger.error(errMsg);
          throw new Error(errMsg);
        }
        
        if (sig.length !== EXPECTED_WOTS_SIGNATURE_SIZE) {
          TxSerializeLogger.warn(`Witness WARNING: proof[${i}].signature is ${sig.length} bytes, expected ${EXPECTED_WOTS_SIGNATURE_SIZE} bytes`);
        }
        
        // Serialize each SignatureProof with its MMR proof
        const sigProof = serializeSignatureProofFromBytes(leafPk, sig, mmrProof);
        signatureProofParts.push(sigProof);
      }
      
      // Wrap all proofs as a Signature (proofCount + proofs)
      const signature = serializeSignature(signatureProofParts);
      parts.push(signature);
      TxSerializeLogger.trace(`Witness Hierarchical signature total: ${signature.length} bytes`);
      
    } else {
      // Per-address TreeKey architecture (2026-02): hierarchical format is REQUIRED
      // Legacy flat format and treeKeyProof format have been removed
      throw new Error('Per-address TreeKey architecture requires hierarchical format with proofs array');
    }
  } else {
    const noSigBytes = writeMiniNumber(0n);
    parts.push(noSigBytes);
    TxSerializeLogger.trace(`Witness signatureCount: ${bytesToHex(noSigBytes)} (empty)`);
  }
  
  // CoinProofs: Each CoinProof hex from server is already serialized by Minima's coinexport
  // Format: Coin (writeDataStream) + MMRProof (writeDataStream)
  if (coinProofsHex && coinProofsHex.length > 0) {
    const coinProofCount = BigInt(coinProofsHex.length);
    const coinProofCountBytes = writeMiniNumber(coinProofCount);
    parts.push(coinProofCountBytes);
    TxSerializeLogger.trace(`Witness coinProofCount: ${bytesToHex(coinProofCountBytes)} (${coinProofsHex.length} proofs)`);
    
    for (let i = 0; i < coinProofsHex.length; i++) {
      // The hex from coinexport is the full CoinProof serialization
      // We need to decode, validate, and potentially fix MiniNumbers with len=0
      const proofHex = coinProofsHex[i];
      TxSerializeLogger.trace(`Witness CoinProof[${i}] hex length: ${proofHex.length}, starts with 0x: ${proofHex.startsWith('0x')}`);
      TxSerializeLogger.trace(`Witness CoinProof[${i}] first 100 chars: ${proofHex.substring(0, 100)}`);
      let proofBytes = hexToBytes(proofHex);
      
      // CRITICAL FIX: Fix any MiniNumbers with len=0 (which cause "Zero length BigInteger")
      // Parse the Coin structure and fix invalid MiniNumbers
      const fixedBytes = fixCoinProofMiniNumbers(proofBytes, i);
      if (fixedBytes.length !== proofBytes.length) {
        TxSerializeLogger.trace(`Witness CoinProof[${i}] FIXED: ${proofBytes.length} -> ${fixedBytes.length} bytes`);
        proofBytes = fixedBytes;
      }
      
      parts.push(proofBytes);
      TxSerializeLogger.trace(`Witness CoinProof[${i}]: ${proofBytes.length} bytes`);
    }
  } else {
    const coinProofCountBytes = writeMiniNumber(0n);
    parts.push(coinProofCountBytes);
    TxSerializeLogger.trace(`Witness coinProofCount: ${bytesToHex(coinProofCountBytes)} (no proofs)`);
  }
  
  // ScriptProofs: One per unique input address
  // For WOTS transactions, the script is "RETURN SIGNEDBY(0xRootPublicKey)"
  // This is required for Minima to verify the transaction - without it, we get NPE
  if (inputScripts && inputScripts.length > 0) {
    // Deduplicate by address (multiple inputs from same address only need one ScriptProof)
    const uniqueScripts = new Map<string, InputScriptInfo>();
    for (const scriptInfo of inputScripts) {
      const normalizedAddr = scriptInfo.address.toLowerCase();
      if (!uniqueScripts.has(normalizedAddr)) {
        uniqueScripts.set(normalizedAddr, scriptInfo);
      }
    }
    
    const scriptCount = uniqueScripts.size;
    const scriptProofCountBytes = writeMiniNumber(BigInt(scriptCount));
    parts.push(scriptProofCountBytes);
    TxSerializeLogger.trace(`Witness scriptProofCount: ${bytesToHex(scriptProofCountBytes)} (${scriptCount} unique addresses)`);
    
    // Emit one ScriptProof per unique address
    for (const [addr, scriptInfo] of uniqueScripts) {
      const unlockScript = buildWotsUnlockScript(scriptInfo.rootPublicKey);
      TxSerializeLogger.trace(`Witness ScriptProof for ${addr.substring(0, 10)}...: ${unlockScript.substring(0, 40)}...`);
      
      const scriptProofBytes = encodeScriptProof(unlockScript);
      parts.push(scriptProofBytes);
      TxSerializeLogger.trace(`Witness ScriptProof: ${scriptProofBytes.length} bytes`);
    }
  } else if (wotsData && wotsData.rootPublicKey) {
    // Fallback: Single WOTS address (legacy support / simple transactions)
    const unlockScript = buildWotsUnlockScript(wotsData.rootPublicKey);
    TxSerializeLogger.trace(`Witness Building single WOTS ScriptProof (fallback): ${unlockScript}`);
    
    const scriptProofCountBytes = writeMiniNumber(1n);
    parts.push(scriptProofCountBytes);
    TxSerializeLogger.trace(`Witness scriptProofCount: ${bytesToHex(scriptProofCountBytes)} (1 script, fallback)`);
    
    const scriptProofBytes = encodeScriptProof(unlockScript);
    parts.push(scriptProofBytes);
    TxSerializeLogger.trace(`Witness ScriptProof: ${scriptProofBytes.length} bytes`);
  } else {
    // No WOTS data - emit empty script proofs (for burn witness, etc.)
    const scriptProofCountBytes = writeMiniNumber(0n);
    parts.push(scriptProofCountBytes);
    TxSerializeLogger.trace(`Witness scriptProofCount: ${bytesToHex(scriptProofCountBytes)} (empty)`);
  }
  
  const result = concat(...parts);
  TxSerializeLogger.trace(`Witness TOTAL: ${result.length} bytes`);
  return result;
}

/**
 * Serialize a complete TxPoW per Minima's TxPoW.writeDataStream()
 *
 * Delegates to @totemsdk/txpow which is the canonical implementation.
 * The private serializeMagic / serializeTxHeader / serializeTxBody functions
 * have been removed — they now live in @totemsdk/txpow/src/serialization.ts.
 *
 * MEG-side mining path: sdkSerializeTxPoW produces a header with nonce=0 and
 * txnDifficulty=MAX_HASH (0xFF…FF).  The MEG node re-mines the TxPoW before
 * inclusion, so this is correct for the txnimport → txnpost flow.
 *
 * For locally-mined TxPoWs, use mineTxPoW() from @totemsdk/txpow directly.
 */
export function serializeTxPoW(
  tx: MinimaTransaction,
  wotsData?: WotsSignatureData,
  coinProofsHex?: string[],
  inputScripts?: InputScriptInfo[]
): Uint8Array {
  const txBytes = serializeTransaction(tx);
  const witnessBytes = serializeWitness(wotsData, coinProofsHex, inputScripts);
  return sdkSerializeTxPoW(txBytes, witnessBytes);
}

/**
 * Build raw witness bytes from signature data and coin proofs.
 *
 * Exposes the internal `serializeWitness` helper so the background service
 * worker can assemble witness bytes for the @totemsdk/txpow `serializeTxBody`
 * call without re-running a full `serializeForTxnImport`.
 */
export function buildWitnessBytes(
  wotsData?: WotsSignatureData,
  coinProofsHex?: string[],
  inputScripts?: InputScriptInfo[]
): Uint8Array {
  return serializeWitness(wotsData, coinProofsHex, inputScripts);
}

export function buildTransaction(params: BuildTransactionParams): TransactionBuildResult {
  const { inputs, recipientAddress, amount, tokenId, changeAddress } = params;
  
  TxBuildLogger.trace(' buildTransaction START:', {
    inputCount: inputs?.length,
    recipientAddress: recipientAddress?.substring(0, 20) + '...',
    recipientFormat: recipientAddress?.startsWith('Mx') ? 'Mx' : recipientAddress?.startsWith('0x') ? 'hex' : 'unknown',
    amount,
    tokenId,
    changeAddress: changeAddress?.substring(0, 20) + '...'
  });
  
  if (!inputs || inputs.length === 0) {
    throw new Error('No input coins provided');
  }
  
  const inputCoins = inputs.map(convertInputCoin);
  
  // Parse send amount - it's a decimal string like "0.0001" or "36000"
  // Convert to base units (10^44) for arithmetic, then back to decimal for output
  const sendAmountBaseUnits = parseDecimalToBaseUnits(amount || '0');
  TxBuildLogger.trace(' Amount:', {
    decimal: amount,
    baseUnits: sendAmountBaseUnits.toString().substring(0, 20) + (sendAmountBaseUnits.toString().length > 20 ? '...' : ''),
    baseUnitsLength: sendAmountBaseUnits.toString().length
  });
  
  // Sum input amounts - convert each decimal string to base units for arithmetic
  const totalInputBaseUnits = inputCoins.reduce((sum, c) => sum + parseDecimalToBaseUnits(c.amount), 0n);
  
  const changeBaseUnits = totalInputBaseUnits - sendAmountBaseUnits;
  TxBuildLogger.trace(' Balance check:', {
    totalInput: formatBaseUnitsToDecimal(totalInputBaseUnits),
    sendAmount: amount,
    change: formatBaseUnitsToDecimal(changeBaseUnits)
  });
  
  if (changeBaseUnits < 0n) {
    throw new Error(`Insufficient funds: have ${formatBaseUnitsToDecimal(totalInputBaseUnits)}, need ${amount}`);
  }
  
  // Normalize recipient address from Mx or hex format
  const normalizedRecipient = normalizeAddressToHex(recipientAddress);
  const recipientBytes = hexToBytes(normalizedRecipient);
  const paddedRecipient = new Uint8Array(32);
  paddedRecipient.set(recipientBytes.slice(0, 32));
  
  // TokenId preserves original length (not padded to 32)
  // For native MINIMA, tokenId is 0x00 (1 byte)
  const tokenIdBytes = tokenId ? hexToBytes(tokenId) : MINIMA_TOKEN_ID;

  // For custom token sends: propagate raw token bytes from the input CoinProof so that both
  // recipient and change output coins carry hasToken=1 + embedded Token metadata.
  // Java's txnimport calls getToken() on every coin whose tokenId is non-native, and NPEs if null.
  // Native Minima inputs have rawTokenData=undefined → outputs get hasToken=0 (unchanged).
  // Use find() across all inputs — if coin[0] failed CoinProof extraction, a later coin may succeed.
  const inputRawTokenData = inputCoins.find(c => c.rawTokenData && c.rawTokenData.length > 0)?.rawTokenData;
  const isCustomTokenSend = tokenIdBytes.length > 1 || tokenIdBytes[0] !== 0x00;
  // Only throw when we know CoinProof extraction ran (coins have rawAmountBytes from the background
  // send path). The popup preview path never runs CoinProof extraction — no rawAmountBytes —
  // so a missing rawTokenData there is expected and should not block the preview.
  const hasCoinProofData = inputCoins.some(c => c.rawAmountBytes && c.rawAmountBytes.length > 0);
  if (isCustomTokenSend && hasCoinProofData && !inputRawTokenData) {
    throw new Error('Cannot send token: failed to extract token metadata from CoinProof. The token field order may be mismatched — check the logs for extraction errors.');
  }
  
  // Output amounts use the original decimal string for send amount (preserves natural scale)
  // For change, convert back from base units to decimal string
  //
  // Custom token output coins carry hasToken=1 + raw token bytes (from input CoinProof).
  // Java reads mToken on output coins to get the token's scale value for the basic
  // conservation check. If mToken is null (hasToken=0), Java cannot compute the output
  // token amount → basic=false. The previous NPE was from the brute-force byte scanner
  // corrupting the token name field — that scanner is now disabled, so clean bytes are safe.
  const outputs: MinimaCoin[] = [
    createOutputCoin(paddedRecipient, amount || '0', tokenIdBytes, true, inputRawTokenData)
  ];
  
  if (changeBaseUnits > 0n) {
    // Normalize change address from Mx or hex format
    const normalizedChangeAddr = changeAddress ? normalizeAddressToHex(changeAddress) : null;
    const changeAddr = normalizedChangeAddr 
      ? hexToBytes(normalizedChangeAddr)
      : inputCoins[0].address;
    const paddedChangeAddr = new Uint8Array(32);
    if (changeAddr instanceof Uint8Array) {
      paddedChangeAddr.set(changeAddr.slice(0, 32));
    }
    // Convert change from base units back to decimal string
    const changeDecimal = formatBaseUnitsToDecimal(changeBaseUnits);
    outputs.push(createOutputCoin(paddedChangeAddr, changeDecimal, tokenIdBytes, false, inputRawTokenData));
  }
  
  const transaction: MinimaTransaction = {
    linkHash: ZERO_TXPOWID,  // 1 byte (0x00), matches Java's MiniData.ZERO_TXPOWID
    inputs: inputCoins,
    outputs: outputs,
    state: []
  };
  
  precomputeTransactionCoinID(transaction);
  
  const digestTx = computeTransactionDigest(transaction);
  const serialized = serializeTransaction(transaction);
  
  return {
    transaction,
    digestTx,
    digestTxHex: bytesToHex(digestTx),
    serialized,
    serializedHex: bytesToHex(serialized)
  };
}

export function buildSignedTxPoW(
  params: BuildTransactionParams,
  wotsData: WotsSignatureData,
  coinProofsHex?: string[],
  inputScripts?: InputScriptInfo[]
): TxPoWBuildResult {
  const buildResult = buildTransaction(params);
  
  const txpowBytes = serializeTxPoW(buildResult.transaction, wotsData, coinProofsHex, inputScripts);
  const txpowHex = bytesToHex(txpowBytes);
  
  return {
    ...buildResult,
    txpowHex
  };
}

/**
 * Encode a MiniString per Minima's MiniString.writeDataStream()
 * 
 * From MiniString.java:
 *   MiniData strdata = new MiniData(getData());
 *   strdata.writeDataStream(zOut);
 * 
 * MiniString uses MiniData format (NOT MiniNumber):
 *   [4-byte int length (big-endian)] + [UTF-8 bytes]
 */
function encodeMiniString(str: string): Uint8Array {
  const utf8Bytes = new TextEncoder().encode(str);
  // MiniData format: 4-byte big-endian length + data
  return writeMiniData(utf8Bytes);
}

/**
 * Encode an empty MMRProof per Minima's MMRProof.writeDataStream()
 * 
 * Format for empty proof:
 *   mBlockTime.writeDataStream(zOut)  // MiniNumber(0)
 *   MiniNumber.WriteToStream(zOut, 0) // proof chain length = 0
 * 
 * Used for simple scripts that don't use MAST branching.
 */
function encodeEmptyMMRProof(): Uint8Array {
  const blockTime = writeMiniNumber(0n);     // MiniNumber(0) for blocktime
  const proofLength = writeMiniNumber(0n);   // MiniNumber(0) for empty proof chain
  return concat(blockTime, proofLength);
}

/**
 * Encode a ScriptProof per Minima's ScriptProof.writeDataStream()
 * 
 * Format:
 *   mScript.writeDataStream(zOut)   // MiniString - the script text
 *   mProof.writeDataStream(zOut)    // MMRProof - empty for simple scripts
 * 
 * For WOTS addresses, the script is "RETURN SIGNEDBY(0xPublicKey)"
 * where PublicKey is the WOTS root public key.
 */
function encodeScriptProof(script: string): Uint8Array {
  TxSerializeLogger.trace(`ScriptProof Encoding script: ${script.substring(0, 50)}...`);
  const scriptBytes = encodeMiniString(script);
  const proofBytes = encodeEmptyMMRProof();
  const result = concat(scriptBytes, proofBytes);
  TxSerializeLogger.trace(`ScriptProof TOTAL: ${result.length} bytes (script: ${scriptBytes.length}, proof: ${proofBytes.length})`);
  return result;
}

/**
 * Build the unlock script for a WOTS address.
 * 
 * For simple WOTS addresses, the script is:
 *   RETURN SIGNEDBY(0xRootPublicKey)
 * 
 * This script says: "This coin can be spent if the transaction is signed
 * by the private key corresponding to this root public key."
 */
function buildWotsUnlockScript(rootPublicKeyHex: string): string {
  const raw = (rootPublicKeyHex.startsWith('0x') || rootPublicKeyHex.startsWith('0X')) ? rootPublicKeyHex.slice(2) : rootPublicKeyHex;
  return `RETURN SIGNEDBY(0x${raw.toUpperCase()})`;
}

/**
 * Serialize transaction for txnimport command.
 * 
 * CRITICAL: txnimport parses data using TxnRow.readDataStream() which expects:
 *   [MiniString ID][Transaction][Witness]
 * 
 * The ID MUST be included in the serialized hex data. The separate `id:` parameter
 * in the RPC command is used to OVERRIDE the embedded ID after parsing, but parsing
 * still requires the MiniString header to align the stream correctly.
 * 
 * Reference: TxnRow.java readDataStream():
 *   mID = MiniString.ReadFromStream(zIn).toString();
 *   mTransaction.readDataStream(zIn);
 *   mWitness.readDataStream(zIn);
 * 
 * @param tx - The transaction object (used only if txSerializedBytes not provided)
 * @param txId - Transaction ID (embedded in TxnRow format)
 * @param wotsData - Optional WOTS signature data for the witness
 * @param coinProofsHex - Optional CoinProof hex strings from coinexport RPC
 * @param inputScripts - Optional input script info for ScriptProofs
 * @param txSerializedBytes - PRE-SERIALIZED transaction bytes (CRITICAL: use this to avoid re-serialization!)
 *                            When provided, these exact bytes are used instead of re-serializing tx.
 *                            This ensures the transaction bytes in txnimport match what was hashed for signing.
 */
export function serializeForTxnImport(
  tx: MinimaTransaction,
  txId: string,
  wotsData?: WotsSignatureData,
  coinProofsHex?: string[],
  inputScripts?: InputScriptInfo[],
  txSerializedBytes?: Uint8Array
): Uint8Array {
  TxSerializeLogger.debug(`TxnImport BUILD: ${BUILD_VERSION}`);
  TxSerializeLogger.debug(`TxnImport txId: ${txId} (included as MiniString header)`);
  TxSerializeLogger.debug(`TxnImport coinProofsHex count: ${coinProofsHex?.length || 0}`);
  TxSerializeLogger.debug(`TxnImport inputScripts count: ${inputScripts?.length || 0}`);
  TxSerializeLogger.debug(`TxnImport txSerializedBytes: ${txSerializedBytes ? `${txSerializedBytes.length} bytes (PRE-SERIALIZED)` : 'NOT PROVIDED (will re-serialize)'}`);
  
  const parts: Uint8Array[] = [];
  
  // 1. MiniString ID (required by TxnRow.readDataStream)
  const idBytes = encodeMiniString(txId);
  parts.push(idBytes);
  TxSerializeLogger.debug(`TxnImport ID section: ${idBytes.length} bytes (MiniString: "${txId}")`);
  
  // 2. Transaction bytes
  // CRITICAL FIX (January 2026): Use pre-serialized bytes if provided to avoid digest mismatch!
  // Re-serializing the MinimaTransaction object can produce different bytes if state like
  // rawAmountBytes is not perfectly preserved, causing the Java node to compute a different
  // transaction ID than what we signed.
  let txBytes: Uint8Array;
  if (txSerializedBytes && txSerializedBytes.length > 0) {
    txBytes = txSerializedBytes;
    TxSerializeLogger.info(`TxnImport: Using PRE-SERIALIZED transaction bytes (${txBytes.length} bytes) - DIGEST WILL MATCH`);
  } else {
    txBytes = serializeTransaction(tx);
    TxSerializeLogger.warn(`TxnImport: RE-SERIALIZING transaction (${txBytes.length} bytes) - potential digest mismatch!`);
  }
  parts.push(txBytes);
  TxSerializeLogger.debug(`TxnImport Transaction section: ${txBytes.length} bytes`);
  
  // 3. Witness bytes (with WOTS signature, CoinProofs, and ScriptProofs)
  const witnessBytes = serializeWitness(wotsData, coinProofsHex, inputScripts);
  parts.push(witnessBytes);
  TxSerializeLogger.debug(`TxnImport Witness section: ${witnessBytes.length} bytes`);
  
  const result = concat(...parts);
  TxSerializeLogger.debug(`TxnImport TOTAL: ${result.length} bytes (TxnRow format)`);
  
  // Hex dump first bytes to verify MiniString header (MiniData format: 4-byte length + string)
  const hexFirst50 = bytesToHex(result.slice(0, 50));
  TxSerializeLogger.debug(`TxnImport First 50 bytes (MiniData: 4-byte len + string): ${hexFirst50}`);
  
  // Verify MiniString encoding (4-byte big-endian length)
  const strLen = (idBytes[0] << 24) | (idBytes[1] << 16) | (idBytes[2] << 8) | idBytes[3];
  TxSerializeLogger.debug(`TxnImport MiniString: len=${strLen}, totalBytes=${idBytes.length}`);
  
  return result;
}

/**
 * Build a transaction and serialize it for txnimport.
 * 
 * This is the main entry point for client-side transaction building.
 * The output can be sent directly to `txnimport data:<hex>`.
 * 
 * @param params - Transaction build parameters (inputs, outputs, amounts)
 * @param txId - Transaction ID to embed in TxnRow format
 * @param wotsData - Optional WOTS signature data
 * @param coinProofsHex - Optional CoinProof hex strings from /v1/wots/coinproofs
 */
export interface TxnImportBuildResult extends TransactionBuildResult {
  txnImportHex: string;
}

export function buildForTxnImport(
  params: BuildTransactionParams,
  txId: string,
  wotsData?: WotsSignatureData,
  coinProofsHex?: string[],
  inputScripts?: InputScriptInfo[]
): TxnImportBuildResult {
  const buildResult = buildTransaction(params);
  
  const txnImportBytes = serializeForTxnImport(buildResult.transaction, txId, wotsData, coinProofsHex, inputScripts);
  const txnImportHex = bytesToHex(txnImportBytes);
  
  return {
    ...buildResult,
    txnImportHex
  };
}

export { hexToBytes, bytesToHex, concat, ZERO_HASH, ZERO_TXPOWID };
