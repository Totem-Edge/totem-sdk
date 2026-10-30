import { bytesToHex, hexToBytes } from '../wasm-sync.js';
import {
  minimaTransactionFromJson,
  precomputeTransactionCoinID,
  rollCoinId,
  serializeTransaction,
  serializeTransactionObject,
} from '../index.js';

const h32 = (b: number) => b.toString(16).padStart(2, '0').repeat(32);

function txJson(order: 'change-first' | 'create-first') {
  const input = { coinid: '0x' + h32(0x11), address: '0x' + h32(0x22), amount: '1', tokenid: '0x00', storestate: false };
  const state = [{ port: 100, svtype: 'hex', data: '0x' + h32(0x33) }];
  const change = { coinid: '0x00', address: '0x' + h32(0x44), amount: '0.5', tokenid: '0x00', storestate: true, state };
  const create = {
    coinid: '0x00', address: '0x' + h32(0x55), amount: '0.5', tokenid: '0x' + h32(0x66),
    storestate: true, state,
    token: { coinid: '0x' + h32(0x66), scale: '0', totalamount: '1000', name: 'TEST', script: '0x00', created: '0' },
  };
  return JSON.stringify({
    linkhash: '0x00', inputs: [input], state: [],
    outputs: order === 'change-first' ? [change, create] : [create, change],
  });
}

describe('public transaction compatibility API', () => {
  it('serializes token+state JSON without the WASM crash and matches TS', () => {
    const json = txJson('change-first');
    const bytes = serializeTransaction(json);
    const objectBytes = serializeTransactionObject(minimaTransactionFromJson(json));
    expect(bytesToHex(bytes)).toBe(bytesToHex(objectBytes));
  });

  it('precomputes coin IDs from input[0].coinId and output index', () => {
    for (const order of ['change-first', 'create-first'] as const) {
      const json = txJson(order);
      const tx = minimaTransactionFromJson(json);
      precomputeTransactionCoinID(tx);
      const base = hexToBytes(h32(0x11));
      expect(bytesToHex(tx.outputs[0].coinId)).toBe(bytesToHex(rollCoinId(base, 0)));
      expect(bytesToHex(tx.outputs[1].coinId)).toBe(bytesToHex(rollCoinId(base, 1)));
      expect(bytesToHex(tx.outputs[0].coinId)).not.toBe(bytesToHex(tx.outputs[1].coinId));
    }
  });

  it('supports the legacy serialized-tx call without using the tx bytes as a coin ID', () => {
    const json = txJson('change-first');
    const txBytes = serializeTransaction(json);
    const output0 = precomputeTransactionCoinID(txBytes, 0);
    const output1 = precomputeTransactionCoinID(txBytes, 1);
    expect(bytesToHex(output0)).toBe(bytesToHex(rollCoinId(hexToBytes(h32(0x11)), 0)));
    expect(bytesToHex(output1)).toBe(bytesToHex(rollCoinId(hexToBytes(h32(0x11)), 1)));
  });
});
