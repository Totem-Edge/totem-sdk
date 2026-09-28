/**
 * RFC-005 Gap #9: transaction deserialization round-trips the byte-exact
 * serializer. serialize → deserialize → serialize must be stable.
 */
import {
  serializeTransactionObject as serializeTransaction,
  deserializeTransaction,
  hexToBytes,
  bytesToHex,
} from '../index.js';
import type { MinimaTransaction, MinimaCoin, MinimaToken } from '../index.js';

const token: MinimaToken = {
  coinId: hexToBytes('aa'.repeat(32)),
  script: hexToBytes('ff'.repeat(8)),
  scale: 2,
  totalAmount: 100000n,
  name: new TextEncoder().encode('Demo Token'),
  created: 12345n,
};

const input: MinimaCoin = {
  coinId: hexToBytes('11'.repeat(32)),
  address: hexToBytes('22'.repeat(32)),
  amount: '10.50',
  tokenId: hexToBytes('00'),
  token: null,
  storeState: true,
  state: [
    { port: 0, type: 'number', value: 42n },
    { port: 1, type: 'string', value: '[hello]' },
    { port: 2, type: 'hex', value: hexToBytes('deadbeef') },
    { port: 3, type: 'bool', value: true },
  ],
  mmrEntryNumber: 7n,
  spent: false,
  created: 100n,
};

const output: MinimaCoin = {
  coinId: hexToBytes('33'.repeat(32)),
  address: hexToBytes('44'.repeat(32)),
  amount: '5',
  tokenId: hexToBytes('00'),
  token,
  storeState: false,
  state: [],
  mmrEntryNumber: 0n,
  spent: false,
  created: 0n,
};

const tx: MinimaTransaction = {
  linkHash: hexToBytes('00'),
  inputs: [input],
  outputs: [output],
  state: [
    { port: 0, type: 'number', value: 9n },
    { port: 1, type: 'bool', value: false },
    { port: 2, type: 'hex', value: hexToBytes('c0ffee') },
  ],
};

describe('transaction serialization round-trip', () => {
  it('deserializeTransaction inverts serializeTransaction', () => {
    const bytes = serializeTransaction(tx);
    const back = deserializeTransaction(bytes);
    expect(back).toEqual(tx);
  });

  it('re-serialization is byte-stable', () => {
    const bytes = serializeTransaction(tx);
    const bytes2 = serializeTransaction(deserializeTransaction(bytes));
    expect(bytesToHex(bytes2)).toBe(bytesToHex(bytes));
  });

  it('rejects truncated input', () => {
    const bytes = serializeTransaction(tx);
    expect(() => deserializeTransaction(bytes.slice(0, bytes.length - 1))).toThrow(/unexpected end|trailing/);
  });

  it('round-trips an empty transaction', () => {
    const empty: MinimaTransaction = { linkHash: hexToBytes('00'), inputs: [], outputs: [], state: [] };
    expect(deserializeTransaction(serializeTransaction(empty))).toEqual(empty);
  });
});
