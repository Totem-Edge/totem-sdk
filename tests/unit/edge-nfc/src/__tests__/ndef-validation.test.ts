import { decodeNdefMessage, encodeNdefMessage } from '../ndef.js';

describe('RFC-074 NDEF byte-level regressions', () => {
  it('encodes an ID-bearing short record with the correct length byte', () => {
    const record = { tnf: 2, type: 'text/plain', id: 'x', payload: Uint8Array.of(0x41) };
    const encoded = encodeNdefMessage([record]);
    expect(Array.from(encoded)).toEqual([
      0xda, 10, 1, 1, 116, 101, 120, 116, 47, 112, 108, 97, 105, 110, 120, 0x41,
    ]);
    expect(decodeNdefMessage(encoded)).toEqual([record]);
  });

  it.each([0, 255, 256, 300, 65536])('roundtrips payload length %s with an ID and a second record', (length) => {
    const payload = Uint8Array.from({ length }, (_, i) => i % 251);
    const records = [
      { tnf: 2, type: 'text/plain', id: 'sensor-1', payload },
      { tnf: 1, type: 'T', id: undefined, payload: Uint8Array.of(2, 101, 110, 65) },
    ];
    const encoded = encodeNdefMessage(records);
    expect(Boolean(encoded[0] & 0x10)).toBe(length <= 255);
    expect(decodeNdefMessage(encoded)).toEqual(records);
  });

  it('uses big-endian long payload length for a 300-byte record', () => {
    const encoded = encodeNdefMessage([{ tnf: 2, type: 'x', payload: new Uint8Array(300) }]);
    expect(Array.from(encoded.subarray(0, 7))).toEqual([0xc2, 1, 0, 0, 1, 44, 120]);
  });

  it('preserves an explicitly empty ID and handles byteOffset views', () => {
    const record = { tnf: 2, type: 'x', id: '', payload: Uint8Array.of(9) };
    const bytes = encodeNdefMessage([record]);
    const padded = new Uint8Array(bytes.length + 8);
    padded.set(bytes, 4);
    expect(decodeNdefMessage(padded.subarray(4, 4 + bytes.length))).toEqual([record]);
  });

  it('rejects every nonempty truncation without returning partial or padded records', () => {
    const encoded = encodeNdefMessage([
      { tnf: 2, type: 'text/plain', id: 'tag', payload: new Uint8Array(300).fill(7) },
      { tnf: 1, type: 'T', payload: Uint8Array.of(1, 2, 3) },
    ]);
    for (let length = 1; length < encoded.length; length++) {
      expect(() => decodeNdefMessage(encoded.subarray(0, length))).toThrow();
    }
  });

  it.each([
    [0xc2, 1, 255, 255, 255, 255, 120], // impossible huge declared payload
    [0x52, 1, 1, 120, 1], // missing MB
    [0xb2, 1, 1, 120, 1], // chunk flag
    [0xd6, 0, 0], // continuation TNF outside a chunk
    [0xd7, 0, 0], // reserved TNF
    [0xd0, 1, 0, 120], // nonempty empty-type record
    [0xd5, 1, 0, 120], // unknown TNF carrying a type
    [0x92, 1, 1, 120, 1], // missing ME
    [0xd2, 1, 1, 120, 1, 0], // trailing garbage
  ])('rejects malformed input %j', (...bytes: number[]) => {
    expect(() => decodeNdefMessage(Uint8Array.from(bytes))).toThrow();
  });

  it('rejects a second MB flag', () => {
    const bytes = encodeNdefMessage([
      { tnf: 2, type: 'x', payload: Uint8Array.of(1) },
      { tnf: 2, type: 'y', payload: Uint8Array.of(2) },
    ]);
    bytes[5] |= 0x80;
    expect(() => decodeNdefMessage(bytes)).toThrow(/message-begin/);
  });

  it.each(['type', 'id'] as const)('rejects overflowing UTF-8 %s lengths', (field) => {
    const record = { tnf: 2, type: 'x', id: 'y', payload: new Uint8Array(0), [field]: 'é'.repeat(128) };
    expect(() => encodeNdefMessage([record])).toThrow(/encoded length/);
  });
});
