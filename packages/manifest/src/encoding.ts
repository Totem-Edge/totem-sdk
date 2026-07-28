/**
 * Wire encoding/decoding for SignedManifest.
 *
 * Format:
 *   [1 byte  MANIFEST_VERSION ]
 *   [1 byte  type discriminant]  0x01=app 0x02=capability 0x03=dapp 0x04=edge-service
 *   [4 bytes big-endian JSON length]
 *   [N bytes canonical JSON (UTF-8)]
 *   [remaining bytes = WOTS signature]
 *
 * The JSON payload is the full SignedManifest object (manifest + metadata + signature).
 * The trailing WOTS signature bytes are stored separately for easy extraction by
 * the DHT / lookup-protocol layer without needing to parse the JSON.
 */

import { MANIFEST_VERSION, MANIFEST_TYPE_BYTE, MANIFEST_BYTE_TO_TYPE } from './constants.js';
import type { SignedManifest, Manifest } from './types.js';

function manifestTypeByte(type: Manifest['type']): number {
  const byte = MANIFEST_TYPE_BYTE[type];
  if (byte === undefined) {
    throw new Error(`encodeManifest: unknown manifest type: ${type}`);
  }
  return byte;
}

export function encodeManifest(signed: SignedManifest): Uint8Array {
  const enc = new TextEncoder();
  const json = JSON.stringify(signed);
  const jsonBytes = enc.encode(json);
  const sigBytes = hexToBytes(signed.signature);

  const len = jsonBytes.length;
  const out = new Uint8Array(1 + 1 + 4 + len + sigBytes.length);
  let offset = 0;

  out[offset++] = MANIFEST_VERSION;
  out[offset++] = manifestTypeByte(signed.manifest.type);
  out[offset++] = (len >>> 24) & 0xff;
  out[offset++] = (len >>> 16) & 0xff;
  out[offset++] = (len >>> 8) & 0xff;
  out[offset++] = len & 0xff;
  out.set(jsonBytes, offset);
  offset += len;
  out.set(sigBytes, offset);

  return out;
}

export function decodeManifest(bytes: Uint8Array): SignedManifest {
  if (bytes.length < 6) {
    throw new Error('decodeManifest: buffer too short (< 6 bytes)');
  }

  const version = bytes[0];
  if (version !== MANIFEST_VERSION) {
    throw new Error(`decodeManifest: unsupported MANIFEST_VERSION ${version}`);
  }

  const typeByte = bytes[1];
  const expectedType = MANIFEST_BYTE_TO_TYPE[typeByte];
  if (!expectedType) {
    throw new Error(`decodeManifest: unknown type discriminant 0x${typeByte.toString(16).padStart(2, '0')}`);
  }

  const jsonLen =
    (bytes[2] << 24) | (bytes[3] << 16) | (bytes[4] << 8) | bytes[5];

  if (bytes.length < 6 + jsonLen) {
    throw new Error(`decodeManifest: buffer too short for declared JSON length ${jsonLen}`);
  }

  const jsonBytes = bytes.slice(6, 6 + jsonLen);
  const json = new TextDecoder().decode(jsonBytes);

  let signed: SignedManifest;
  try {
    signed = JSON.parse(json) as SignedManifest;
  } catch (e) {
    throw new Error(`decodeManifest: invalid JSON payload: ${String(e)}`);
  }

  if (signed.manifest?.type !== expectedType) {
    throw new Error(
      `decodeManifest: type discriminant mismatch — wire says '${expectedType}' but JSON manifest.type is '${signed.manifest?.type}'`,
    );
  }

  return signed;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  if (hex.length % 2 !== 0) throw new Error('hexToBytes: odd-length hex string');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
