/**
 * RFC-031 P2 — randomized serialization parity (WASM ↔ TS) + round-trip stability.
 *
 * Deterministic-seeded fuzz over amount scales, multi-byte MiniNumbers
 * (mmrentry/created/state), and input/output counts. Complements the fixed
 * fixtures in transaction.serializer-parity.test.ts and guards the drift class
 * fixed by RFC-018 P2-3 and RFC-020 P2-10.
 */

import { bytesToHex, hexToBytes } from '../wasm-sync.js';
import {
  serializeTransaction as wasmSerialize,
  serializeTransactionObject,
  deserializeTransaction,
} from '../index.js';
import type { MinimaTransaction, MinimaCoin } from '../index.js';

const h32 = (b: number) => b.toString(16).padStart(2, '0').repeat(32);

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function randHex(rand: () => number, bytes = 32): string {
  let out = '';
  for (let i = 0; i < bytes; i++) out += Math.floor(rand() * 256).toString(16).padStart(2, '0');
  return out;
}

function randAmount(rand: () => number): string {
  const whole = Math.floor(rand() * 1_000_000);
  const dp = Math.floor(rand() * 9); // 0..8
  if (dp === 0) return String(whole);
  let frac = '';
  for (let i = 0; i < dp; i++) frac += Math.floor(rand() * 10);
  return `${whole}.${frac}`;
}

function randBig(rand: () => number, maxBytes = 10): bigint {
  const bytes = 1 + Math.floor(rand() * maxBytes);
  let v = 0n;
  for (let i = 0; i < bytes; i++) v = (v << 8n) | BigInt(Math.floor(rand() * 256));
  return v;
}

interface Fixture {
  tx: MinimaTransaction;
  json: Record<string, unknown>;
}

function makeCoin(rand: () => number, index: number): Fixture['tx']['inputs'][number] {
  const coinId = index === 0 ? h32(0x11) : h32(0x22 + index);
  const amount = randAmount(rand);
  const stateValue = randBig(rand);
  const state = [{ port: Math.floor(rand() * 8), type: 'number' as const, value: stateValue }];
  const mmrEntryNumber = randBig(rand, 4);
  const created = randBig(rand, 4);
  return {
    coinId: hexToBytes(coinId),
    address: hexToBytes(h32(0x44)),
    amount,
    tokenId: hexToBytes('00'),
    token: null,
    storeState: false,
    state,
    mmrEntryNumber,
    spent: false,
    created,
  };
}

function makeFixture(seed: number): Fixture {
  const rand = rng(seed);
  const inputCount = Math.floor(rand() * 3); // 0..2
  const outputCount = Math.floor(rand() * 3);

  const inputs = Array.from({ length: inputCount }, (_, i) => makeCoin(rand, i));
  const outputs = Array.from({ length: outputCount }, () => ({
    ...makeCoin(rand, 0),
    coinId: hexToBytes('00'),
    created: 0n,
    mmrEntryNumber: 0n,
    state: [],
  }));

  const tx: MinimaTransaction = {
    linkHash: hexToBytes(h32(0xaa)),
    inputs,
    outputs,
    state: [],
  };

  const json = {
    linkhash: h32(0xaa),
    inputs: inputs.map((c) => ({
      coinid: bytesToHex(c.coinId),
      amount: c.amount,
      address: bytesToHex(c.address),
      tokenid: '00',
      state: c.state.map((s) => ({
        port: s.port,
        type: (s as { type: string }).type,
        data: String((s as { value?: unknown }).value ?? ''),
      })),
      storestate: c.storeState,
      mmrentry: c.mmrEntryNumber.toString(),
      spent: c.spent,
      created: c.created.toString(),
    })),
    outputs: outputs.map((c) => ({
      amount: c.amount,
      address: bytesToHex(c.address),
      tokenid: '00',
      state: [],
      storestate: c.storeState,
      mmrentry: '0',
      spent: false,
      created: '0',
    })),
    state: [],
  };

  return { tx, json };
}

describe('RFC-031 P2: randomized serializer parity', () => {
  it('matches WASM bytes and round-trips for 100 seeded fixtures', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { tx, json } = makeFixture(seed);
      const wasm = wasmSerialize(JSON.stringify(json));
      const ts = serializeTransactionObject(tx);
      expect(bytesToHex(wasm)).toBe(bytesToHex(ts));

      // serialize → deserialize → serialize is byte-stable.
      const back = deserializeTransaction(wasm);
      expect(bytesToHex(serializeTransactionObject(back))).toBe(bytesToHex(wasm));
    }
  });
});
