/**
 * RFC-005 Gap #9: @totemsdk/tx-builder exposes an object-based transaction
 * serializer/deserializer (re-exported from core) plus hex conveniences.
 */
import { hexToBytes, bytesToHex } from '@totemsdk/core';
import type { MinimaTransaction } from '@totemsdk/core';
import {
  serializeTransaction,
  deserializeTransaction,
  serializeTransactionHex,
  deserializeTransactionHex,
} from '../index.js';

const tx: MinimaTransaction = {
  linkHash: hexToBytes('00'),
  inputs: [
    {
      coinId: hexToBytes('11'.repeat(32)),
      address: hexToBytes('22'.repeat(32)),
      amount: '1.5',
      tokenId: hexToBytes('00'),
      token: null,
      storeState: true,
      state: [{ port: 0, type: 'number', value: 1n }],
      mmrEntryNumber: 3n,
      spent: false,
      created: 10n,
    },
  ],
  outputs: [
    {
      coinId: hexToBytes('33'.repeat(32)),
      address: hexToBytes('44'.repeat(32)),
      amount: '1.5',
      tokenId: hexToBytes('00'),
      token: null,
      storeState: true,
      state: [{ port: 0, type: 'number', value: 1n }],
      mmrEntryNumber: 0n,
      spent: false,
      created: 0n,
    },
  ],
  state: [],
};

describe('tx-builder serialization surface', () => {
  it('round-trips through the hex helpers', () => {
    const hex = serializeTransactionHex(tx);
    expect(deserializeTransactionHex(hex)).toEqual(tx);
    expect(deserializeTransactionHex('0x' + hex)).toEqual(tx);
  });

  it('serializeTransaction/deserializeTransaction round-trip', () => {
    const bytes = serializeTransaction(tx);
    expect(bytesToHex(serializeTransaction(deserializeTransaction(bytes)))).toBe(bytesToHex(bytes));
  });
});
