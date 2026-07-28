/**
 * WOTS Parameter Set - BouncyCastle Compatible (w=8)
 * 
 * Matches Minima Java implementation which uses BouncyCastle:
 * - Winternitz.java: WINTERNITZ_VALUE = 8
 * - WinternitzOTSignature.java: w=8 means 8 BITS per digit (not base-8)
 * - SHA3-256 hash function (mdsize = 32 bytes)
 * 
 * Chain count calculation (from WinternitzOTSignature constructor):
 *   messagesize = ((mdsize << 3) + w - 1) / w = (256 + 7) / 8 = 32
 *   checksumsize = getLog((messagesize << w) + 1) = getLog(8193) = 14 bits
 *   keysize = messagesize + (checksumsize + w - 1) / w = 32 + (14 + 7) / 8 = 34
 * 
 * So L = 34 chains total, each chain value is 0-255 (8-bit digit)
 */
export type ParamSet = {
  name: 'minima';
  n: 256;           // hash output bits
  w: 8;             // Winternitz parameter: 8 BITS per digit
  L: 34;            // Total chains: 32 message + 2 checksum
  messageSize: 32;  // Number of message digits
  checksumSize: 14; // Checksum bits
  checksumDigits: 2; // Number of checksum digits
  maxDigit: 255;    // Maximum digit value (2^w - 1)
};

export const WOTS_MINIMA: ParamSet = { 
  name: 'minima', 
  n: 256, 
  w: 8, 
  L: 34,
  messageSize: 32,
  checksumSize: 14,
  checksumDigits: 2,
  maxDigit: 255,
};

// Legacy aliases for backwards compatibility during migration
export const WOTS_V1_DEV = WOTS_MINIMA;
export const WOTS_V2_SPEC = WOTS_MINIMA;

export function getParamSet(_env?: string): ParamSet {
  return WOTS_MINIMA;
}
