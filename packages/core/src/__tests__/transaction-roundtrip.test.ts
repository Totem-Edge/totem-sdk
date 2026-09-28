/**
 * RFC-005 Gap #9: transaction deserialization round-trips the byte-exact
 * serializer. serialize → deserialize → serialize must be stable.
 */
import {
  serializeTransactionObject as serializeTransaction,
  deserializeTransaction,
  computeTokenId,
  serializeTokenDescriptor,
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

describe('token id computation', () => {
  it('is a deterministic 32-byte hash of the token descriptor', () => {
    const id = computeTokenId(token);
    expect(id.length).toBe(32);
    expect(bytesToHex(computeTokenId(token))).toBe(bytesToHex(id));
    expect(serializeTokenDescriptor(token).length).toBeGreaterThan(0);
  });

  it('changes when metadata changes', () => {
    const a = computeTokenId(token);
    const b = computeTokenId({ ...token, name: new TextEncoder().encode('{"name":"Other"}') });
    expect(bytesToHex(a)).not.toBe(bytesToHex(b));
  });

  it('NFT (scale 44) and fungible (scale 2) ids differ', () => {
    expect(bytesToHex(computeTokenId({ ...token, scale: 44 }))).not.toBe(bytesToHex(computeTokenId({ ...token, scale: 2 })));
  });

  it('matches the C++ node oracle token descriptor bytes (mynft, decimals 0)', () => {
    // Oracle: totem-node tests/test_serialization.cpp §6 (Token.writeDataStream)
    const enc = (s: string) => new TextEncoder().encode(s);
    const nft = {
      coinId: new Uint8Array([0x00]),
      scale: 44,
      totalAmount: 1n,
      totalAmountScale: 44,
      name: enc('{"name":"mynft"}'),
      script: enc('RETURN TRUE'),
      created: 0n,
    };
    expect(bytesToHex(serializeTokenDescriptor(nft)).toLowerCase()).toBe(
      '00000001000000000b52455455524e205452554500012c2c0101000000107b226e616d65223a226d796e6674227d000100',
    );
  });
});
