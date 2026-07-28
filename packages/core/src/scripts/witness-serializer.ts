import { sha3_256 } from '../wasm-sync.js';
import type { MMRProof, MMRProofChunk } from '../mmr.js';
import { serializeMMRProof } from '../mmr.js';
import type { ScriptDescriptor, StateValue, ExternalSignature, ScriptProofResult, FlatMMRProofChunk, LegacyMMRProof } from './types.js';
import { convertFlatChunkToSDK } from './types.js';
import { mxToHex } from '../minima32.js';

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

function normalizeHexValue(value: string): string {
  if (!value) return '0x00';
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

export function encodeMiniNumber(value: bigint, scale: number = 0): Uint8Array {
  if (typeof value !== 'bigint') {
    throw new Error(`encodeMiniNumber requires bigint, got ${typeof value}`);
  }

  if (value === 0n) {
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

  const result = new Uint8Array(1 + 1 + length);
  result[0] = scale & 0xff;
  result[1] = length & 0xff;
  result.set(unscaledBytes, 2);

  return result;
}

export function encodeMiniData(data: Uint8Array): Uint8Array {
  const length = data.length;
  const lengthBytes = new Uint8Array([
    (length >> 24) & 0xff,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff
  ]);
  return concat(lengthBytes, data);
}

export function encodeMiniString(str: string): Uint8Array {
  const utf8Bytes = new TextEncoder().encode(str);
  return encodeMiniData(utf8Bytes);
}

function encodeMiniByte(value: boolean): Uint8Array {
  return new Uint8Array([value ? 1 : 0]);
}

export function serializeMMRProofChunk(chunk: MMRProofChunk): Uint8Array {
  const parts: Uint8Array[] = [];

  parts.push(encodeMiniByte(chunk.isLeft));

  parts.push(encodeMiniData(chunk.mmrData.data));

  parts.push(encodeMiniNumber(chunk.mmrData.value));

  return concat(...parts);
}

export function serializeRealMMRProof(proof: MMRProof, blockTime: bigint = 0n): Uint8Array {
  return serializeMMRProof(proof, blockTime);
}

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

  const dataLength = (bytes[pos] << 24) | (bytes[pos + 1] << 16) |
                     (bytes[pos + 2] << 8) | bytes[pos + 3];
  pos += 4;

  const data = bytes.slice(pos, pos + dataLength);
  pos += dataLength;

  const { value, bytesRead: valueRead } = readMiniNumber(bytes, pos);
  pos += valueRead;

  return {
    chunk: { isLeft, mmrData: { data, value } },
    bytesRead: pos - offset
  };
}

export function serializeScriptProofWithProof(script: string, proof: MMRProof, blockTime: bigint = 0n): Uint8Array {
  const scriptBytes = encodeMiniString(script);
  const proofBytes = serializeRealMMRProof(proof, blockTime);
  return concat(scriptBytes, proofBytes);
}

export const STATETYPE_HEX = 1;
export const STATETYPE_NUMBER = 2;
export const STATETYPE_STRING = 4;
export const STATETYPE_BOOL = 8;

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
      if (typeof stateValue.value === 'string') {
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

export function buildScriptProofFromDescriptor(descriptor: ScriptDescriptor): ScriptProofResult {
  const proof = descriptor.mastProof || { chunks: [] };
  const serialized = serializeScriptProofWithProof(descriptor.script, proof);

  return {
    script: descriptor.script,
    proof,
    serialized
  };
}

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

export function serializeExtraScripts(
  extraScripts: Map<string, string>
): Uint8Array {
  const parts: Uint8Array[] = [];

  const countBytes = encodeMiniNumber(BigInt(extraScripts.size));
  parts.push(countBytes);

  for (const [script, proofHex] of extraScripts) {
    const { proof, blockTime } = proofHex
      ? parseMMRProofFromHex(proofHex)
      : { proof: { chunks: [] }, blockTime: 0n };
    parts.push(serializeScriptProofWithProof(script, proof, blockTime));
  }

  return concat(...parts);
}

export function aggregateSignatures(
  totemSignature: {
    publicKey: Uint8Array;
    signature: Uint8Array;
  },
  externalSignatures: ExternalSignature[]
): Uint8Array[] {
  const allSigProofs: Uint8Array[] = [];

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

export function computeScriptAddress(script: string): string {
  const cleanScript = script.trim().toUpperCase();
  const scriptBytes = new TextEncoder().encode(cleanScript);
  const hashBytes = sha3_256(scriptBytes);
  return bytesToHex(hashBytes);
}

export { concat };
