/**
 * RFC-031 Fix A: the wasm-free byte utilities must be byte-exact with the WASM
 * kernels they replace (`bytes_to_hex` uppercase, `hex_to_bytes`, `concat_bytes`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  bytesToHex,
  hexToBytes,
  concatBytes,
} from '../bytes.js';
import {
  bytesToHex as wasmBytesToHex,
  hexToBytes as wasmHexToBytes,
  concatBytes as wasmConcatBytes,
} from '../wasm-sync.js';

const rnd = (n: number) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));

describe('wasm-free bytes parity', () => {
  it('bytesToHex matches the WASM kernel (uppercase) for random + edge cases', () => {
    expect(bytesToHex(new Uint8Array())).toBe(wasmBytesToHex(new Uint8Array()));
    for (let i = 0; i < 256; i++) {
      const b = rnd(i % 64);
      expect(bytesToHex(b)).toBe(wasmBytesToHex(b));
    }
    expect(bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe('DEADBEEF');
  });

  it('hexToBytes matches the WASM kernel (incl. 0x prefix, mixed case)', () => {
    for (let i = 0; i < 256; i++) {
      const h = wasmBytesToHex(rnd(i % 64));
      expect(Array.from(hexToBytes(h))).toEqual(Array.from(wasmHexToBytes(h)));
    }
    expect(Array.from(hexToBytes('0xDEADbeef'))).toEqual(Array.from(wasmHexToBytes('0xDEADbeef')));
    expect(Array.from(hexToBytes(''))).toEqual([]);
  });

  it('hexToBytes rejects odd-length and non-hex input like the WASM kernel', () => {
    expect(() => hexToBytes('abc')).toThrow();
    expect(() => hexToBytes('zz')).toThrow();
    expect(() => wasmHexToBytes('abc')).toThrow();
    expect(() => wasmHexToBytes('zz')).toThrow();
  });

  it('concatBytes matches the WASM kernel (binary) and is variadic', () => {
    for (let i = 0; i < 64; i++) {
      const a = rnd(i % 16);
      const b = rnd((i * 3) % 16);
      expect(Array.from(concatBytes(a, b))).toEqual(Array.from(wasmConcatBytes(a, b)));
    }
    expect(Array.from(concatBytes(new Uint8Array([1]), new Uint8Array([]), new Uint8Array([2, 3])))).toEqual([
      1, 2, 3,
    ]);
  });

  it('the pure modules do not import the WASM bridge', () => {
    for (const f of ['../bytes.ts', '../canonical.ts']) {
      const src = readFileSync(join(__dirname, f), 'utf8');
      expect(src).not.toMatch(/from\s+['"][^'"]*(wasm-sync|core-wasm)/);
    }
  });
});
