import { codec, CODEC_VERSION } from '../codec.js';
import { StorageError } from '../errors.js';

describe('codec', () => {
  it('serializes and deserializes primitives and nested structures', () => {
    const value = { a: 1, b: 'x', c: [1, 2, 3], d: { e: true }, f: null };
    expect(codec.deserialize(codec.serialize(value))).toEqual(value);
  });

  it('tag-round-trips bigint', () => {
    const value = { n: 123456789012345678901234567890n };
    expect(codec.deserialize(codec.serialize(value))).toEqual(value);
  });

  it('round-trips Uint8Array', () => {
    const bytes = new Uint8Array([0, 1, 254, 255]);
    const result = codec.deserialize(codec.serialize(bytes)) as Uint8Array;
    expect(result).toBeInstanceOf(Uint8Array);
    expect([...result]).toEqual([0, 1, 254, 255]);
  });

  it('rejects non-finite numbers', () => {
    expect(() => codec.serialize({ n: NaN })).toThrow(StorageError);
    expect(() => codec.serialize({ n: Infinity })).toThrow(StorageError);
  });

  it('rejects undefined values', () => {
    expect(() => codec.serialize({ n: undefined })).toThrow(StorageError);
  });

  it('exposes the current version', () => {
    expect(codec.version).toBe(CODEC_VERSION);
  });

  it('rejects an unsupported version as corrupt with version detail', () => {
    const forward = codec;
    // Bump magic + version header manually in a copy.
    const bytes = codec.serialize({ a: 1 });
    const bumped = new Uint8Array(bytes.length);
    bumped.set(bytes, 0);
    bumped[CODEC_VERSION >= 255 ? 4 : 4] = 2; // header: magic(4) + version byte at index 4
    try {
      forward.deserialize(bumped);
      throw new Error('expected StorageError');
    } catch (err) {
      expect(err).toBeInstanceOf(StorageError);
      expect((err as StorageError).code).toBe('corrupt');
      const details = (err as StorageError).details;
      expect(details.unsupportedVersion).toBe(2);
    }
  });

  it('rejects data with a bad magic header as corrupt', () => {
    const bytes = codec.serialize('x');
    const bad = new Uint8Array(bytes.length);
    bad.set(bytes, 0);
    bad[0] = 0x00;
    expect(() => codec.deserialize(bad)).toThrow(StorageError);
    try {
      codec.deserialize(bad);
    } catch (err) {
      expect((err as StorageError).code).toBe('corrupt');
    }
  });
});