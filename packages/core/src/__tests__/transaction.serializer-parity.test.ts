/**
 * RFC-018 P2-3: WASM/TS transaction serializer parity.
 *
 * The Rust/WASM serializer (`serializeTransaction`, JSON input) and the TS
 * object serializer (`serializeTransactionObject`) must produce byte-identical
 * output for the same transaction, and the TS deserializer must reproduce the
 * WASM bytes. Regressions fixed here:
 *   - the Rust MMR-entry encoder wrote the unscaled value where the scale
 *     MiniNumber belonged;
 *   - the TS string-state encoder wrapped values in `[ … ]` (KISSVM literal
 *     syntax, not part of the stored MiniString).
 */
import { bytesToHex, hexToBytes } from '../wasm-sync.js';
import {
  serializeTransaction as wasmSerialize,
  serializeTransactionObject,
  deserializeTransaction,
} from '../index.js';
import type { MinimaTransaction, MinimaCoin } from '../index.js';

const h32 = (byte: number) => byte.toString(16).padStart(2, '0').repeat(32);

function inputFixture(): MinimaCoin {
  return {
    coinId: hexToBytes(h32(0x11)),
    address: hexToBytes(h32(0x22)),
    amount: '1.5',
    tokenId: hexToBytes('00'),
    token: null,
    storeState: true,
    state: [
      { port: 0, type: 'number', value: 1n },
      { port: 1, type: 'bool', value: true },
      { port: 2, type: 'hex', value: hexToBytes('abcd') },
      { port: 3, type: 'string', value: 'hello' },
    ],
    mmrEntryNumber: 3n,
    spent: false,
    created: 10n,
  };
}

function outputFixture(): MinimaCoin {
  return {
    coinId: hexToBytes('00'),
    address: hexToBytes(h32(0x44)),
    amount: '0.25',
    tokenId: hexToBytes('00'),
    token: null,
    storeState: false,
    state: [{ port: 7, type: 'number', value: 99n }],
    mmrEntryNumber: 0n,
    spent: false,
    created: 0n,
  };
}

const tx: MinimaTransaction = {
  linkHash: hexToBytes(h32(0xaa)),
  inputs: [inputFixture()],
  outputs: [outputFixture()],
  state: [{ port: 9, type: 'number', value: 42n }],
};

const txJson = {
  linkhash: h32(0xaa),
  inputs: [
    {
      coinid: h32(0x11),
      amount: '1.5',
      address: h32(0x22),
      tokenid: '00',
      state: [
        { port: 0, type: 'number', data: '1' },
        { port: 1, type: 'bool', data: 'true' },
        { port: 2, type: 'hex', data: 'abcd' },
        { port: 3, type: 'string', data: 'hello' },
      ],
      storestate: true,
      mmrentry: '3',
      spent: false,
      created: '10',
    },
  ],
  outputs: [
    {
      amount: '0.25',
      address: h32(0x44),
      tokenid: '00',
      state: [{ port: 7, type: 'number', data: '99' }],
      storestate: false,
      mmrentry: '0',
      spent: false,
      created: '0',
    },
  ],
  state: [{ port: 9, type: 'number', data: '42' }],
};

describe('RFC-018 P2-3: WASM/TS serializer parity', () => {
  it('serializes state, mmr-entry, created and top-level state identically', () => {
    const wasm = wasmSerialize(JSON.stringify(txJson));
    const ts = serializeTransactionObject(tx);
    expect(bytesToHex(wasm)).toBe(bytesToHex(ts));
  });

  it('round-trips WASM bytes through the TS deserializer', () => {
    const wasm = wasmSerialize(JSON.stringify(txJson));
    const parsed = deserializeTransaction(wasm);
    expect(bytesToHex(serializeTransactionObject(parsed))).toBe(bytesToHex(wasm));
  });

  it('serializes a token-bearing input identically', () => {
    const tokenTx: MinimaTransaction = {
      linkHash: hexToBytes('00'),
      inputs: [
        {
          ...inputFixture(),
          amount: '2',
          state: [],
          mmrEntryNumber: 5n,
          created: 7n,
          token: {
            coinId: hexToBytes('00'),
            scale: 0,
            totalAmount: 1000n,
            totalAmountScale: 0,
            name: new TextEncoder().encode('T'),
            script: hexToBytes('52'),
          },
        },
      ],
      outputs: [],
      state: [],
    };
    const tokenJson = {
      linkhash: '00',
      inputs: [
        {
          coinid: h32(0x11),
          amount: '2',
          address: h32(0x22),
          tokenid: '00',
          state: [],
          storestate: true,
          mmrentry: '5',
          spent: false,
          created: '7',
          token: {
            coinid: '00',
            scale: '0',
            totalamount: '1000',
            name: 'T',
            script: '0x52',
            created: '0',
          },
        },
      ],
      outputs: [],
      state: [],
    };
    const wasm = wasmSerialize(JSON.stringify(tokenJson));
    expect(bytesToHex(wasm)).toBe(bytesToHex(serializeTransactionObject(tokenTx)));
  });

  it('serializes a precomputed non-zero output coin id identically (RFC-020 P1-11)', () => {
    const outCoinId = h32(0x33);
    const tx: MinimaTransaction = {
      linkHash: hexToBytes('00'),
      inputs: [],
      outputs: [{ ...outputFixture(), coinId: hexToBytes(outCoinId) }],
      state: [],
    };
    const json = {
      linkhash: '00',
      inputs: [],
      outputs: [
        {
          coinid: outCoinId,
          amount: '0.25',
          address: h32(0x44),
          tokenid: '00',
          state: [{ port: 7, type: 'number', data: '99' }],
          storestate: false,
          mmrentry: '0',
          spent: false,
          created: '0',
        },
      ],
      state: [],
    };
    const wasm = wasmSerialize(JSON.stringify(json));
    expect(bytesToHex(wasm)).toBe(bytesToHex(serializeTransactionObject(tx)));
  });
});
