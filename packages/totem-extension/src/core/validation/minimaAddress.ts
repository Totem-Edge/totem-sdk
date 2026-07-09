/**
 * Minima Address Validation
 * Validates Mx (Base32 with checksum) and 0x (raw hex) address formats
 */

import { sha3_256 } from 'js-sha3';

export interface AddressValidationResult {
  valid: boolean;
  reason?: string;
  format?: 'mx' | 'hex';
}

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

function decodeMxRadix32Frame(mx: string): Uint8Array {
  let s = mx.trim().toLowerCase();
  if (s.startsWith('mx')) s = s.slice(2);
  s = s.replace(/w/g, 'i').replace(/y/g, 'l').replace(/z/g, 'o');

  let x = 0n;
  for (const ch of s) {
    const v = parseInt(ch, 32);
    if (Number.isNaN(v)) throw new Error(`Invalid base32 character: ${ch}`);
    x = x * 32n + BigInt(v);
  }
  return bigIntToBytes(x);
}

function validateMxChecksum(mx: string): { valid: boolean; reason?: string } {
  try {
    const frame = decodeMxRadix32Frame(mx);
    
    if (frame.length < 39) {
      return { valid: false, reason: 'Address too short' };
    }
    
    if (frame[0] !== 0x01) {
      return { valid: false, reason: 'Invalid address format' };
    }
    
    const len = (frame[1] << 8) | frame[2];
    if (len !== 32) {
      return { valid: false, reason: 'Invalid address length' };
    }
    
    const root32 = frame.slice(3, 35);
    const checksum = frame.slice(35, 39);
    
    const expectedChk = sha3_256.arrayBuffer(root32);
    const expected = new Uint8Array(expectedChk).slice(0, 4);
    
    for (let i = 0; i < 4; i++) {
      if (checksum[i] !== expected[i]) {
        return { valid: false, reason: 'Invalid checksum - address may be corrupted' };
      }
    }
    
    return { valid: true };
  } catch (error: any) {
    return { valid: false, reason: error.message || 'Invalid Mx address format' };
  }
}

function validateHexAddress(hex: string): { valid: boolean; reason?: string } {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  
  if (cleanHex.length !== 64) {
    return { valid: false, reason: `Invalid hex address length (expected 64 chars, got ${cleanHex.length})` };
  }
  
  if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
    return { valid: false, reason: 'Invalid hex characters in address' };
  }
  
  return { valid: true };
}

export function validateMinimaAddress(address: string): AddressValidationResult {
  if (!address || typeof address !== 'string') {
    return { valid: false, reason: 'Address is required' };
  }
  
  const trimmed = address.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, reason: 'Address is required' };
  }
  
  if (trimmed.toLowerCase().startsWith('mx')) {
    const result = validateMxChecksum(trimmed);
    return { ...result, format: 'mx' };
  }
  
  if (trimmed.startsWith('0x')) {
    const result = validateHexAddress(trimmed);
    return { ...result, format: 'hex' };
  }
  
  return { 
    valid: false, 
    reason: 'Address must start with Mx or 0x' 
  };
}

export function isValidMinimaAddress(address: string): boolean {
  return validateMinimaAddress(address).valid;
}
