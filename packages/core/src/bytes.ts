/**
 * Wasm-free byte utilities (RFC-031 Fix A).
 *
 * Byte-exact equivalents of the WASM kernels `bytes_to_hex` (uppercase, via
 * `hex::encode_upper`), `hex_to_bytes` (strips a leading lowercase `0x`),
 * and `concat_bytes`. Living outside `wasm-sync` lets pure consumers and the
 * core root avoid loading the WASM artifact for hex/concat work.
 */

export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s.toUpperCase();
}

export function hexToBytes(hex: string): Uint8Array {
  const s = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (s.length % 2 !== 0) throw new Error('Invalid hex: odd-length string');
  const out = new Uint8Array(s.length >> 1);
  for (let i = 0; i < out.length; i++) {
    const pair = s.slice(i * 2, i * 2 + 2);
    if (!/^[0-9a-fA-F]{2}$/.test(pair)) throw new Error(`Invalid hex: ${pair}`);
    out[i] = parseInt(pair, 16);
  }
  return out;
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const a of arrays) len += a.length;
  const out = new Uint8Array(len);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}
