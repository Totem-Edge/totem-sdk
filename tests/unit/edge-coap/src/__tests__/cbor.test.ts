import { CborDecodeError, decodeCbor } from '../cbor.js';

function hex(value: string): Uint8Array {
  const clean = value.replace(/\s+/g, '');
  return Uint8Array.from((clean.match(/../g) ?? []).map((byte) => parseInt(byte, 16)));
}

function decode(value: string): unknown {
  return decodeCbor(hex(value));
}

describe('CBOR decoder (RFC 8949 Appendix A)', () => {
  it.each([
    ['00', 0],
    ['01', 1],
    ['0a', 10],
    ['17', 23],
    ['1818', 24],
    ['1819', 25],
    ['1864', 100],
    ['1903e8', 1000],
    ['1a000f4240', 1000000],
    ['1b000000e8d4a51000', 1000000000000],
    ['20', -1],
    ['29', -10],
    ['3863', -100],
    ['3903e7', -1000],
  ])('decodes integer %s', (input, expected) => {
    expect(decode(input)).toBe(expected);
  });

  it('decodes integers beyond Number.MAX_SAFE_INTEGER as bigint', () => {
    expect(decode('1bffffffffffffffff')).toBe(18446744073709551615n);
    expect(decode('3bffffffffffffffff')).toBe(-18446744073709551616n);
  });

  it.each([
    ['f4', false],
    ['f5', true],
    ['f6', null],
    ['f7', undefined],
  ])('decodes simple value %s', (input, expected) => {
    expect(decode(input)).toBe(expected);
  });

  it('decodes half, single and double floats', () => {
    expect(decode('f93e00')).toBeCloseTo(1.5, 10);
    expect(decode('f97bff')).toBe(65504);
    expect(decode('f90001')).toBeCloseTo(2 ** -24, 12);
    expect(decode('fa47c35000')).toBe(100000);
    expect(decode('fb3ff199999999999a')).toBeCloseTo(1.1, 12);
  });

  it('decodes byte and text strings', () => {
    expect(Array.from(decode('4401020304') as Uint8Array)).toEqual([1, 2, 3, 4]);
    expect(Array.from(decode('40') as Uint8Array)).toEqual([]);
    expect(decode('6161')).toBe('a');
    expect(decode('6449455446')).toBe('IETF');
    expect(decode('62225c')).toBe('"\\');
    expect(decode('62c3bc')).toBe('ü');
    expect(decode('60')).toBe('');
  });

  it('decodes definite and indefinite arrays', () => {
    expect(decode('83010203')).toEqual([1, 2, 3]);
    expect(decode('8301820203820405')).toEqual([1, [2, 3], [4, 5]]);
    expect(decode('9f018202039f0405ffff')).toEqual([1, [2, 3], [4, 5]]);
    expect(decode('9fff')).toEqual([]);
  });

  it('decodes indefinite byte and text strings', () => {
    expect(Array.from(decode('5f42010243030405ff') as Uint8Array)).toEqual([1, 2, 3, 4, 5]);
    expect(decode('7f657374726561646d696e67ff')).toBe('streaming');
  });

  it('decodes maps with text keys to objects and other keys to Map', () => {
    expect(decode('a26161016162820203')).toEqual({ a: 1, b: [2, 3] });
    expect(decode('a201020304')).toEqual(new Map([[1, 2], [3, 4]]));
    expect(decode('a0')).toEqual({});
    expect(decode('a1616101')).toEqual({ a: 1 });
  });

  it('unwraps tags', () => {
    expect(decode('c074323031332d30332d32315432303a30343a30305a')).toBe('2013-03-21T20:04:00Z');
    expect(decode('c11a514b67b0')).toBe(1363896240);
  });

  it('decodes nested sensor-shaped documents', () => {
    // {"temp": 21.5, "ok": true, "id": h'01'}
    const value = decode('a36474656d70fb4035800000000000626f6bf56269644101');
    expect(value).toEqual({ temp: 21.5, ok: true, id: Uint8Array.of(1) });
  });

  it.each([
    ['empty input', ''],
    ['truncated argument', '18'],
    ['truncated string', '44 01 02'],
    ['reserved additional information', '1c'],
    ['trailing bytes', '00 00'],
    ['reserved simple value', 'f8 20'],
    ['duplicate keys', 'a2 61 61 01 61 61 02'],
    ['reserved __proto__ key', 'a1 69 5f 5f 70 72 6f 74 6f 5f 5f 01'],
    ['unexpected break', 'ff'],
    ['indefinite integer', '1f'],
    ['invalid utf-8 text', '61 ff'],
  ])('rejects %s', (_name, input) => {
    expect(() => decode(input)).toThrow(CborDecodeError);
  });

  it('enforces the nesting limit', () => {
    const nested = '81'.repeat(40) + '00';
    expect(() => decode(nested)).toThrow(/nesting exceeds/);
    expect(typeof decodeCbor(hex(nested), { maxDepth: 64 })).toBe('object');
  });
});
