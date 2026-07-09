/**
 * Minima "Mx" Base32 Encoding
 * Matches org.minima.utils.BaseConverter.encode32/decode32
 * 
 * Source behavior: BigInteger radix-32, then character swaps (i→w, l→y, o→z),
 * uppercased, prefixed with "Mx".
 */

import { sha3_256 } from '@noble/hashes/sha3';

function bytesToBigInt(bytes: Uint8Array): bigint {
  let x = 0n;
  for (const b of bytes) x = (x << 8n) | BigInt(b);
  return x;
}

function bigIntToBytes(x: bigint): Uint8Array {
  if (x === 0n) return new Uint8Array([0]);
  let hex = x.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  }
  return out;
}

/**
 * Encode bytes to Minima Mx format with character substitution
 */
export function encodeMxRadix32Frame(frame: Uint8Array): string {
  let s = bytesToBigInt(frame).toString(32).toLowerCase();
  // Minima swaps ambiguous letters, then uppercases and adds prefix
  s = s.replace(/i/g, 'w').replace(/l/g, 'y').replace(/o/g, 'z');
  return 'Mx' + s.toUpperCase();
}

/**
 * Decode Minima Mx format to bytes (reverses character substitution)
 */
export function decodeMxRadix32Frame(mx: string): Uint8Array {
  let s = mx.trim().toLowerCase();
  if (s.startsWith('mx')) s = s.slice(2);
  s = s.replace(/w/g, 'i').replace(/y/g, 'l').replace(/z/g, 'o'); // reverse swaps

  // parse base-32 by hand (radix 32)
  let x = 0n;
  for (const ch of s) {
    const v = parseInt(ch, 32);
    if (Number.isNaN(v)) throw new Error(`Invalid base32 character: ${ch}`);
    x = x * 32n + BigInt(v);
  }
  return bigIntToBytes(x);
}

/**
 * Create Minima Mx address from 32 bytes
 * Format: [sentinel=0x01] || [len_u16_be=0x0020] || [data_32bytes] || [checksum_4bytes]
 */
export function makeMxAddress(data: Uint8Array): string {
  if (!(data instanceof Uint8Array) || data.length !== 32) {
    throw new Error('makeMxAddress requires exactly 32 bytes');
  }
  
  const SENTINEL = 0x01;
  const prefix = new Uint8Array([SENTINEL, 0x00, 0x20]); // 32 bytes len
  const frame = new Uint8Array(prefix.length + data.length);
  frame.set(prefix, 0); 
  frame.set(data, prefix.length);
  
  // Calculate checksum of the payload data only
  const checksum = sha3_256(data).slice(0, 4);
  const out = new Uint8Array(frame.length + 4); 
  out.set(frame, 0); 
  out.set(checksum, frame.length);
  
  return encodeMxRadix32Frame(out);
}

/**
 * Parse Minima Mx address to extract 32-byte payload
 */
export function parseMxAddress(addr: string): Uint8Array {
  const SENTINEL = 0x01;
  const bytes = decodeMxRadix32Frame(addr);
  
  // Validate frame structure
  if (bytes[0] !== SENTINEL || bytes[1] !== 0x00 || bytes[2] !== 0x20) {
    throw new Error('Invalid Mx header');
  }
  
  const data = bytes.slice(3, 3 + 32);
  const gotChecksum = bytes.slice(3 + 32, 3 + 32 + 4);
  const expectedChecksum = sha3_256(data).slice(0, 4);
  
  // Validate checksum
  for (let i = 0; i < 4; i++) {
    if (gotChecksum[i] !== expectedChecksum[i]) {
      throw new Error('Mx checksum mismatch');
    }
  }
  
  return data;
}

/**
 * Convert Minima Mx address to 0x-prefixed hex string
 */
export function mxToHex(addr: string): string {
  if (addr.startsWith('0x')) return addr;
  const bytes = parseMxAddress(addr);
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Convert 0x-prefixed hex string to Minima Mx address
 */
export function hexToMx(hex: string): string {
  if (!hex || !hex.startsWith('0x')) return hex;
  const clean = hex.slice(2);
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(2 * i, 2 * i + 2), 16);
  }
  return makeMxAddress(bytes);
}
