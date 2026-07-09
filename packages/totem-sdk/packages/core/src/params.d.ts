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
    n: 256;
    w: 8;
    L: 34;
    messageSize: 32;
    checksumSize: 14;
    checksumDigits: 2;
    maxDigit: 255;
};
export declare const WOTS_MINIMA: ParamSet;
export declare const WOTS_V1_DEV: ParamSet;
export declare const WOTS_V2_SPEC: ParamSet;
export declare function getParamSet(_env?: string): ParamSet;
