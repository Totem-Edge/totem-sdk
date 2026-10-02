/**
 * RFC-031 P2 — WASM ↔ JS-kernel differential parity.
 *
 * For kernels that exist in both the WASM bridge and the TypeScript kernels,
 * assert identical results on deterministic inputs. Complements the oracle
 * suites (wots-parity, transaction.serializer-parity, Streamable.parity,
 * perAddressDerivation.parity). The JS side is a drift guard, not an oracle.
 */

import {
  bytesToHex as wasmBytesToHex,
  hexToBytes as wasmHexToBytes,
  concatBytes as wasmConcat,
  makeMxAddress as wasmMakeMxAddress,
  parseMxAddress as wasmParseMxAddress,
  phraseToSeed as wasmPhraseToSeed,
  validatePhrase as wasmValidatePhrase,
  cleanSeedPhrase as wasmCleanSeedPhrase,
  wotsKeypairFromSeed as wasmWotsKeypair,
} from '../wasm-sync.js';
import { concat as jsConcat } from '../Streamable.js';
import { makeMxAddress as jsMakeMxAddress, parseMxAddress as jsParseMxAddress } from '../minima32.js';
import { phraseToSeed as jsPhraseToSeed, validatePhrase as jsValidatePhrase, cleanSeedPhrase as jsCleanSeedPhrase } from '../bip39.js';
import { wotsKeypairFromSeed as jsWotsKeypair } from '../wots.js';

const hex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');

// Standard BIP39 vector (entropy 0), 24 words.
const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';

function seededBytes(seed: number, len: number): Uint8Array {
  const out = new Uint8Array(len);
  let s = seed >>> 0;
  for (let i = 0; i < len; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = (s >>> 24) & 0xff;
  }
  return out;
}

describe('RFC-031 P2: WASM ↔ JS kernel differential parity', () => {
  it('BIP39 phraseToSeed / validatePhrase / cleanSeedPhrase', () => {
    expect(wasmValidatePhrase(MNEMONIC)).toBe(true);
    expect(jsValidatePhrase(MNEMONIC)).toBe(true);
    expect(hex(wasmPhraseToSeed(MNEMONIC))).toBe(hex(jsPhraseToSeed(MNEMONIC)));
    expect(wasmCleanSeedPhrase(`  ${MNEMONIC}  `)).toBe(jsCleanSeedPhrase(`  ${MNEMONIC}  `));
  });

  it('address makeMxAddress / parseMxAddress', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const root = seededBytes(seed, 32);
      const wasmAddr = wasmMakeMxAddress(root);
      expect(wasmAddr).toBe(jsMakeMxAddress(root));
      expect(hex(wasmParseMxAddress(wasmAddr))).toBe(hex(jsParseMxAddress(wasmAddr)));
      expect(hex(wasmParseMxAddress(wasmAddr))).toBe(hex(root));
    }
  });

  it('wotsKeypairFromSeed returns identical keypair', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const s = seededBytes(seed, 32);
      const wasm = wasmWotsKeypair(s, seed);
      const js = jsWotsKeypair(s, seed);
      expect(wasm.index).toBe(js.index);
      expect(hex(wasm.pk)).toBe(hex(js.pk));
      expect(hex(wasm.seed)).toBe(hex(js.seed));
    }
  });

  it('concatBytes matches the JS concat', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const a = seededBytes(seed, 5);
      const b = seededBytes(seed + 100, 7);
      expect(hex(wasmConcat(a, b))).toBe(hex(jsConcat(a, b)));
    }
  });

  it('hex codec round-trips', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const bytes = seededBytes(seed, 32);
      const encoded = wasmBytesToHex(bytes);
      expect(hex(wasmHexToBytes(encoded))).toBe(hex(bytes));
    }
  });
});
