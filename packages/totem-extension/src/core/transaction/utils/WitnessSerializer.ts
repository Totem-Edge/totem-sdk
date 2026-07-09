/**
 * Witness Serialization Utilities for Complex Minima Scripts
 * 
 * This module provides serialization functions for:
 * - Real MMRProofs (not just empty proofs)
 * - ScriptProofs with MAST support
 * - State variables
 * - External signature aggregation
 * 
 * These utilities enable Totem to build witnesses for all Minima script types.
 * 
 * CONSOLIDATION (2026-01-18): Now uses SDK canonical types and serialization functions.
 */

import { sha3_256 } from 'js-sha3';
import type { 
  MMRProof, 
  MMRProofChunk, 
  ScriptDescriptor, 
  StateValue,
  ExternalSignature,
  ScriptProofResult,
  FlatMMRProofChunk,
  LegacyMMRProof
} from '../types/ScriptTypes';
import { convertFlatChunkToSDK } from '../types/ScriptTypes';
import { mxToHex } from '../../utils/minima-base32';

// Import canonical serialization from SDK
import { serializeMMRProof } from '../../../../../totem-sdk/packages/core/src/mmr';

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

/**
 * Normalize hex/address string to 0x format.
 * Handles both Mx (Minima Base32) and 0x formats.
 * Matches Java's StateVariable constructor behavior.
 */
function normalizeHexValue(value: string): string {
  if (!value) {
    return '0x00';
  }
  const trimmed = value.trim();
  
  if (trimmed.toLowerCase().startsWith('mx')) {
    return mxToHex(trimmed);
  }
  
  return trimmed.startsWith('0x') ? trimmed : '0x' + trimmed;
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

/**
 * Encode a MiniNumber per Minima's Java serialization format.
 * 
 * MiniNumber format (per MiniNumber.java):
 *   - 1 byte: scale (number of decimal places)
 *   - 1 byte: length of unscaled data
 *   - N bytes: unscaled BigInteger bytes (big-endian, two's complement)
 * 
 * CRITICAL: Uses 1-byte length, NOT 4-byte like MiniData!
 */
function encodeMiniNumber(value: bigint, scale: number = 0): Uint8Array {
  if (typeof value !== 'bigint') {
    throw new Error(`encodeMiniNumber requires bigint, got ${typeof value}`);
  }
  
  if (value === 0n) {
    // For value 0: scale + len=1 + data=0x00 → 3 bytes
    return new Uint8Array([scale & 0xff, 1, 0]);
  }
  
  if (value < 0n) {
    throw new Error(`encodeMiniNumber does not support negative values: ${value}`);
  }
  
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) {
    hex = '0' + hex;
  }
  
  let unscaledBytes = hexToBytes(hex);
  
  // BigInteger uses two's complement; add leading 0 if high bit set
  if (unscaledBytes.length > 0 && (unscaledBytes[0] & 0x80) !== 0) {
    const withLeadingZero = new Uint8Array(unscaledBytes.length + 1);
    withLeadingZero[0] = 0x00;
    withLeadingZero.set(unscaledBytes, 1);
    unscaledBytes = withLeadingZero;
  }
  
  const length = unscaledBytes.length;
  
  if (length > 32) {
    throw new Error(`MiniNumber data too large: ${length} bytes (max 32)`);
  }
  
  // Format: scale (1 byte) + length (1 byte) + data (N bytes)
  const result = new Uint8Array(1 + 1 + length);
  result[0] = scale & 0xff;
  result[1] = length & 0xff;
  result.set(unscaledBytes, 2);
  
  return result;
}

/**
 * Encode MiniData per Minima's format.
 */
function encodeMiniData(data: Uint8Array): Uint8Array {
  const length = data.length;
  const lengthBytes = new Uint8Array([
    (length >> 24) & 0xff,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff
  ]);
  return concat(lengthBytes, data);
}

/**
 * Encode a MiniString per Minima's format.
 */
function encodeMiniString(str: string): Uint8Array {
  const utf8Bytes = new TextEncoder().encode(str);
  return encodeMiniData(utf8Bytes);
}

/**
 * Encode a MiniByte (boolean).
 */
function encodeMiniByte(value: boolean): Uint8Array {
  return new Uint8Array([value ? 1 : 0]);
}

/**
 * Serialize an MMRProofChunk per Minima's MMRProofChunk.writeDataStream()
 * Uses SDK canonical types (mmrData.data and mmrData.value).
 * 
 * Format:
 *   mIsLeft (MiniByte) - 0x00 for right, 0x01 for left
 *   mData (MMRData) - the sibling hash + value
 * 
 * MMRData format:
 *   mData (MiniData - 4-byte length prefix + hash)
 *   mValue (MiniNumber)
 */
export function serializeMMRProofChunk(chunk: MMRProofChunk): Uint8Array {
  const parts: Uint8Array[] = [];
  
  parts.push(encodeMiniByte(chunk.isLeft));
  
  // Hash as MiniData (4-byte length prefix + data)
  parts.push(encodeMiniData(chunk.mmrData.data));
  
  // Value as MiniNumber
  parts.push(encodeMiniNumber(chunk.mmrData.value));
  
  return concat(...parts);
}

/**
 * Serialize a real MMRProof per Minima's MMRProof.writeDataStream()
 * Now uses SDK canonical serializeMMRProof function.
 * 
 * @param proof - The MMRProof to serialize (SDK format with chunks array)
 * @param blockTime - Block time for the proof (default 0n)
 */
export function serializeRealMMRProof(proof: MMRProof, blockTime: bigint = 0n): Uint8Array {
  return serializeMMRProof(proof, blockTime);
}

/**
 * Parse an MMRProof from hex (from mmrcreate or other RPC commands).
 * Returns SDK format with blockTime separately.
 * 
 * @param proofHex - The proof hex string from Minima RPC
 * @returns SDK format MMRProof and blockTime
 */
export function parseMMRProofFromHex(proofHex: string): { proof: MMRProof; blockTime: bigint } {
  const bytes = hexToBytes(proofHex);
  let offset = 0;
  
  const { value: blockTime, bytesRead: btRead } = readMiniNumber(bytes, offset);
  offset += btRead;
  
  const { value: chainLength, bytesRead: clRead } = readMiniNumber(bytes, offset);
  offset += clRead;
  
  const chunks: MMRProofChunk[] = [];
  for (let i = 0; i < Number(chainLength); i++) {
    const { chunk, bytesRead } = readMMRProofChunk(bytes, offset);
    chunks.push(chunk);
    offset += bytesRead;
  }
  
  return { proof: { chunks }, blockTime };
}

function readMiniNumber(bytes: Uint8Array, offset: number): { value: bigint; bytesRead: number } {
  const scale = bytes[offset];
  const length = (bytes[offset + 1] << 24) | (bytes[offset + 2] << 16) | 
                 (bytes[offset + 3] << 8) | bytes[offset + 4];
  
  if (length === 0) {
    return { value: 0n, bytesRead: 5 };
  }
  
  const dataBytes = bytes.slice(offset + 5, offset + 5 + length);
  let value = 0n;
  for (const b of dataBytes) {
    value = (value << 8n) | BigInt(b);
  }
  
  return { value, bytesRead: 5 + length };
}

function readMMRProofChunk(bytes: Uint8Array, offset: number): { chunk: MMRProofChunk; bytesRead: number } {
  let pos = offset;
  
  const isLeft = bytes[pos] === 1;
  pos += 1;
  
  // Read hash (MiniData format: 4-byte length + data)
  const dataLength = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | 
                     (bytes[pos + 2] << 8) | bytes[pos + 3];
  pos += 4;
  
  const data = bytes.slice(pos, pos + dataLength);
  pos += dataLength;
  
  // Read value (MiniNumber)
  const { value, bytesRead: valueRead } = readMiniNumber(bytes, pos);
  pos += valueRead;
  
  // Return SDK format with mmrData
  return {
    chunk: { isLeft, mmrData: { data, value } },
    bytesRead: pos - offset
  };
}

/**
 * Serialize a ScriptProof with real MMRProof support.
 * 
 * From ScriptProof.writeDataStream():
 *   mScript.writeDataStream(zOut);   // MiniString
 *   mProof.writeDataStream(zOut);    // MMRProof
 * 
 * @param script - The script text
 * @param proof - The MMRProof in SDK format (can be empty for simple scripts)
 * @param blockTime - Block time for the proof (default 0n)
 */
export function serializeScriptProofWithProof(script: string, proof: MMRProof, blockTime: bigint = 0n): Uint8Array {
  const scriptBytes = encodeMiniString(script);
  const proofBytes = serializeRealMMRProof(proof, blockTime);
  return concat(scriptBytes, proofBytes);
}

/**
 * Java-compatible StateVariable type constants.
 * From StateVariable.java:
 *   STATETYPE_HEX = 1
 *   STATETYPE_NUMBER = 2
 *   STATETYPE_STRING = 4
 *   STATETYPE_BOOL = 8
 */
export const STATETYPE_HEX = 1;
export const STATETYPE_NUMBER = 2;
export const STATETYPE_STRING = 4;
export const STATETYPE_BOOL = 8;

/**
 * Encode a state variable value for transaction state.
 * 
 * JAVA-COMPATIBLE FORMAT (from StateVariable.writeDataStream):
 *   1. port (MiniByte - 1 byte, 0-255)
 *   2. type (MiniByte - 1 byte: HEX=1, NUMBER=2, STRING=4, BOOL=8)
 *   3. data (format depends on type):
 *      - BOOL: MiniByte (1 byte: 0 or 1)
 *      - HEX: MiniData (4-byte length + data)
 *      - NUMBER: MiniNumber (scale + len + data)
 *      - STRING: MiniString (4-byte length + UTF-8 bytes)
 * 
 * @param stateValue - State value with port, type, and value
 */
export function encodeStateValue(stateValue: StateValue): Uint8Array {
  if (stateValue.port < 0 || stateValue.port > 255) {
    throw new Error(`StateVariable port must be 0-255, got ${stateValue.port}`);
  }
  
  const portByte = new Uint8Array([stateValue.port]);
  
  let typeByte: Uint8Array;
  let dataBytes: Uint8Array;
  
  switch (stateValue.type) {
    case 'bool':
      typeByte = new Uint8Array([STATETYPE_BOOL]);
      if (typeof stateValue.value === 'boolean') {
        dataBytes = new Uint8Array([stateValue.value ? 1 : 0]);
      } else if (typeof stateValue.value === 'string') {
        const boolValue = stateValue.value.toUpperCase() === 'TRUE';
        dataBytes = new Uint8Array([boolValue ? 1 : 0]);
      } else {
        throw new Error(`Invalid bool state value: ${stateValue.value}`);
      }
      break;
      
    case 'number':
      typeByte = new Uint8Array([STATETYPE_NUMBER]);
      if (typeof stateValue.value === 'bigint') {
        dataBytes = encodeMiniNumber(stateValue.value);
      } else if (typeof stateValue.value === 'string') {
        const numValue = BigInt(stateValue.value);
        dataBytes = encodeMiniNumber(numValue);
      } else {
        throw new Error(`Invalid number state value: ${stateValue.value}`);
      }
      break;
      
    case 'hex':
      typeByte = new Uint8Array([STATETYPE_HEX]);
      // Normalize Mx addresses to 0x, matches Java's StateVariable constructor
      if (typeof stateValue.value === 'string') {
        const normalizedHex = normalizeHexValue(stateValue.value);
        dataBytes = encodeMiniData(hexToBytes(normalizedHex));
      } else if (stateValue.value instanceof Uint8Array) {
        dataBytes = encodeMiniData(stateValue.value);
      } else {
        throw new Error(`Invalid hex state value: ${stateValue.value}`);
      }
      break;
      
    case 'string':
      typeByte = new Uint8Array([STATETYPE_STRING]);
      // Java stores strings with brackets: [my string]
      if (typeof stateValue.value === 'string') {
        // Add brackets if not already present
        let bracketedValue = stateValue.value;
        if (!stateValue.value.startsWith('[') || !stateValue.value.endsWith(']')) {
          bracketedValue = `[${stateValue.value}]`;
        }
        dataBytes = encodeMiniString(bracketedValue);
      } else {
        throw new Error(`Invalid string state value: ${stateValue.value}`);
      }
      break;
      
    default:
      throw new Error(`Unknown state value type: ${(stateValue as any).type}`);
  }
  
  return concat(portByte, typeByte, dataBytes);
}

/**
 * Serialize multiple state variables for a transaction.
 */
export function serializeStateVariables(stateValues: StateValue[]): Uint8Array {
  const parts: Uint8Array[] = [];
  
  const countBytes = encodeMiniNumber(BigInt(stateValues.length));
  parts.push(countBytes);
  
  const sorted = [...stateValues].sort((a, b) => a.port - b.port);
  
  for (const sv of sorted) {
    parts.push(encodeStateValue(sv));
  }
  
  return concat(...parts);
}

/**
 * Build a ScriptProof from a ScriptDescriptor.
 * 
 * Handles:
 * - Simple SIGNEDBY scripts (empty proof)
 * - MAST scripts (with merkle proof to branch)
 * - Custom scripts
 */
export function buildScriptProofFromDescriptor(descriptor: ScriptDescriptor): ScriptProofResult {
  // Use SDK format: { chunks: [] } for empty proofs
  const proof = descriptor.mastProof || { chunks: [] };
  const serialized = serializeScriptProofWithProof(descriptor.script, proof);
  
  return {
    script: descriptor.script,
    proof,
    serialized
  };
}

/**
 * Deduplicate script descriptors by address.
 * 
 * When multiple inputs share the same address, only one ScriptProof is needed.
 */
export function deduplicateScriptDescriptors(
  descriptors: ScriptDescriptor[]
): Map<string, ScriptDescriptor> {
  const unique = new Map<string, ScriptDescriptor>();
  
  for (const desc of descriptors) {
    const normalizedAddr = desc.address.toLowerCase();
    if (!unique.has(normalizedAddr)) {
      unique.set(normalizedAddr, desc);
    }
  }
  
  return unique;
}

/**
 * Serialize extra scripts for MAST branches (txnscript equivalent).
 * 
 * For MAST contracts, we need to include the executed branch script
 * and its merkle proof in the witness.
 */
export function serializeExtraScripts(
  extraScripts: Map<string, string>
): Uint8Array {
  const parts: Uint8Array[] = [];
  
  const countBytes = encodeMiniNumber(BigInt(extraScripts.size));
  parts.push(countBytes);
  
  for (const [script, proofHex] of extraScripts) {
    // parseMMRProofFromHex returns { proof, blockTime } in SDK format
    const { proof, blockTime } = proofHex 
      ? parseMMRProofFromHex(proofHex) 
      : { proof: { chunks: [] }, blockTime: 0n };
    parts.push(serializeScriptProofWithProof(script, proof, blockTime));
  }
  
  return concat(...parts);
}

/**
 * Aggregate external signatures with Totem's signature.
 * 
 * For multisig transactions, Totem adds its own signature and
 * includes signatures from other parties.
 */
export function aggregateSignatures(
  totemSignature: {
    publicKey: Uint8Array;
    signature: Uint8Array;
  },
  externalSignatures: ExternalSignature[]
): Uint8Array[] {
  const allSigProofs: Uint8Array[] = [];
  
  // Use SDK format: { chunks: [] } for empty proofs
  allSigProofs.push(serializeSignatureProof(
    totemSignature.publicKey,
    totemSignature.signature,
    { chunks: [] }
  ));
  
  for (const extSig of externalSignatures) {
    if (!extSig.validated) {
      console.warn(`[AggregateSignatures] Skipping unvalidated signature from ${extSig.publicKey}`);
      continue;
    }
    
    const proof = extSig.proof || { chunks: [] };
    allSigProofs.push(serializeSignatureProof(
      hexToBytes(extSig.publicKey),
      hexToBytes(extSig.signature),
      proof
    ));
  }
  
  return allSigProofs;
}

/**
 * Serialize a SignatureProof per Minima's SignatureProof.writeDataStream()
 */
function serializeSignatureProof(
  publicKey: Uint8Array,
  signature: Uint8Array,
  proof: MMRProof
): Uint8Array {
  const parts: Uint8Array[] = [];
  
  parts.push(encodeMiniData(publicKey));
  parts.push(encodeMiniData(signature));
  parts.push(serializeRealMMRProof(proof));
  
  return concat(...parts);
}

/**
 * Validate an external signature against transaction data.
 * 
 * This is a placeholder - actual validation requires the transaction
 * digest and knowledge of the signature scheme (WOTS vs standard).
 */
export function validateExternalSignature(
  signature: ExternalSignature,
  transactionDigest: Uint8Array
): boolean {
  if (!signature.publicKey || !signature.signature) {
    return false;
  }
  
  console.log(`[ValidateSignature] Validating signature from ${signature.publicKey.substring(0, 16)}...`);
  
  return true;
}

/**
 * Compute script address (sha3-256 hash of script).
 */
export function computeScriptAddress(script: string): string {
  const cleanScript = script.trim().toUpperCase();
  const scriptBytes = new TextEncoder().encode(cleanScript);
  const hashBytes = new Uint8Array(sha3_256.arrayBuffer(scriptBytes));
  return bytesToHex(hashBytes);
}

export { hexToBytes, bytesToHex, concat, encodeMiniNumber, encodeMiniData, encodeMiniString };
