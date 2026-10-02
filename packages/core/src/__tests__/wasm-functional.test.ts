/**
 * RFC-031 P2 — WASM functional / self-consistency tests.
 *
 * Kernels with no direct JS counterpart (challenge, stateful WasmTreeKey,
 * MMR root, mining-adjacent hashing, params) are exercised through the WASM API
 * itself so they are covered rather than forever `pending`.
 */

import {
  createChallenge,
  validateChallenge,
  wasmTreeKeyNew,
  wasmTreeKeySign,
  wasmTreeKeyGetPublicKey,
  wasmTreeKeyGetUses,
  wasmTreeKeySetUses,
  wasmTreeKeyGetMaxUses,
  wasmTreeKeyFree,
  timingSafeEqual,
  getParams,
  hashChain,
  expandPrivateKey,
  mmrRootFromPublicKeys,
  generateWordList,
  validatePhrase,
  wotsAddressFromKeypair as wasmWotsAddress,
  wotsKeypairFromSeed as wasmWotsKeypair,
  mineTxPoW,
  mineTxPoWChunk,
} from '../wasm-sync.js';
import { wotsAddressFromKeypair as jsWotsAddress } from '../script.js';
import { wotsKeypairFromSeed as jsWotsKeypair } from '../wots.js';

const hex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
const seed = new Uint8Array(32).fill(7);

describe('RFC-031 P2: WASM functional kernels', () => {
  it('createChallenge / validateChallenge round-trip and domain binding', () => {
    const challenge = createChallenge('dapp.example', 'Sign in');
    expect(typeof challenge).toBe('string');
    expect(validateChallenge(challenge, 'dapp.example')).toBe(true);
    expect(validateChallenge(challenge, 'evil.example')).toBe(false);
  });

  it('stateful WasmTreeKey: derive, set uses, sign', () => {
    const handle = wasmTreeKeyNew(seed, 64, 3);
    try {
      expect(wasmTreeKeyGetMaxUses(handle)).toBe(64 * 64 * 64);
      const pk = wasmTreeKeyGetPublicKey(handle);
      expect(pk.length).toBe(32);
      wasmTreeKeySetUses(handle, 7);
      expect(wasmTreeKeyGetUses(handle)).toBe(7);
      const signature = wasmTreeKeySign(handle, new Uint8Array(32).fill(0xab));
      expect(typeof signature).toBe('string');
      const parsed = JSON.parse(signature) as { proofs: Array<{ leafPubkey: number[] }> };
      expect(parsed.proofs).toHaveLength(3);
      expect(parsed.proofs[0].leafPubkey).toHaveLength(32);
    } finally {
      wasmTreeKeyFree(handle);
    }
  });

  it('timingSafeEqual compares correctly', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('getParams exposes the WOTS parameter set', () => {
    const params = getParams() as Record<string, unknown>;
    expect(params).toBeTruthy();
    const values = Object.values(params);
    expect(values.length).toBeGreaterThan(0);
    expect(values.some((v) => typeof v === 'number')).toBe(true);
  });

  it('hashChain and expandPrivateKey are deterministic with 32-byte output', () => {
    const input = new Uint8Array(32).fill(0x11);
    const chain1 = hashChain(input, 3);
    const chain2 = hashChain(input, 3);
    expect(chain1.length).toBe(32);
    expect(hex(chain1)).toBe(hex(chain2));

    const expanded1 = expandPrivateKey(seed);
    const expanded2 = expandPrivateKey(seed);
    expect(expanded1.length).toBe(1088); // expanded WOTS private key
    expect(hex(expanded1)).toBe(hex(expanded2));
  });

  it('mmrRootFromPublicKeys is deterministic with 32-byte output', () => {
    const pks = new Uint8Array(32 * 3);
    for (let i = 0; i < 3; i++) pks.fill(0x10 + i, i * 32, i * 32 + 32);
    const root1 = mmrRootFromPublicKeys(pks, 3);
    const root2 = mmrRootFromPublicKeys(pks, 3);
    expect(root1.length).toBe(32);
    expect(hex(root1)).toBe(hex(root2));
  });

  it('generateWordList yields a valid 24-word phrase', () => {
    const phrase = generateWordList();
    expect(phrase.trim().split(/\s+/)).toHaveLength(24);
    expect(validatePhrase(phrase)).toBe(true);
  });

  it('wotsAddressFromKeypair matches the JS script kernel', () => {
    const wasmAddr = wasmWotsAddress(seed, 0);
    const jsAddr = jsWotsAddress(jsWotsKeypair(seed, 0));
    expect(wasmAddr).toBe(jsAddr);
    expect(wasmAddr).toBe(wasmWotsAddress(wasmWotsKeypair(seed, 0)));
  });

  it('mineTxPoW / mineTxPoWChunk produce a valid result at an easy target', () => {
    const body = new Uint8Array(64).fill(0x42);
    const easyTarget = new Uint8Array(32).fill(0xff); // any hash is below it
    const timeMs = 1_700_000_000_000;

    const json = JSON.parse(mineTxPoW(body, easyTarget, timeMs, 0)) as {
      minedHeaderBytes: string;
      txpowId: string;
      nonce: string;
      iterations: string;
    };
    expect(json.minedHeaderBytes).toMatch(/^[0-9a-fA-F]+$/);
    expect(json.txpowId).toMatch(/^[0-9a-fA-F]{64}$/);
    expect(BigInt(json.nonce)).toBe(0n);

    const chunkNonce = mineTxPoWChunk(body, easyTarget, timeMs, 0, 100);
    expect(chunkNonce).toBe('0');
  });
});
