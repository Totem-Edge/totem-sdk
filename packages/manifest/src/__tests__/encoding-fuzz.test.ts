/**
 * Deterministic property/fuzz tests for manifest wire encoding.
 *
 * The decoder must either return a SignedManifest of the wire-declared type or
 * throw a controlled Error. Random bytes must never leak TypeError/RangeError.
 */

import { decodeManifest, encodeManifest } from '../encoding';
import type { Manifest, SignedManifest } from '../types';

const TYPES = ['app', 'capability', 'dapp', 'edge-service'] as const;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function int(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function hex(rng: () => number, bytes: number): string {
  let out = '';
  for (let i = 0; i < bytes; i += 1) out += int(rng, 0, 255).toString(16).padStart(2, '0');
  return out;
}

function makeSigned(rng: () => number): SignedManifest {
  const type = TYPES[int(rng, 0, TYPES.length - 1)];
  const address = `Mx${int(rng, 0, 1_000_000)}`;
  const manifest = {
    type,
    name: `manifest-${int(rng, 0, 100000)}`,
    version: `1.${int(rng, 0, 99)}.${int(rng, 0, 99)}`,
    ...(type === 'capability' ? { agentAddress: address } : {}),
    ...(type === 'edge-service' ? { operatorAddress: address } : {}),
    ...(type === 'app' || type === 'dapp' ? { authorAddress: address } : {}),
    metadata: {
      n: int(rng, -1000, 1000),
      flag: rng() < 0.5,
      nested: { value: `v-${int(rng, 0, 1000)}` },
    },
  } as unknown as Manifest;
  return {
    manifest,
    authorAddress: address,
    signerPublicKey: hex(rng, 32),
    signedAt: int(rng, 0, 2_000_000_000_000),
    signature: hex(rng, 64),
  };
}

describe('manifest encoding properties', () => {
  it('round-trips 500 generated manifests', () => {
    const rng = mulberry32(0x0a11a5);
    for (let i = 0; i < 500; i += 1) {
      const signed = makeSigned(rng);
      const decoded = decodeManifest(encodeManifest(signed));
      expect(decoded).toEqual(signed);
    }
  });

  it('rejects arbitrary bytes with a controlled Error', () => {
    const rng = mulberry32(0xbad0b);
    for (let i = 0; i < 2000; i += 1) {
      const bytes = new Uint8Array(int(rng, 0, 256));
      for (let j = 0; j < bytes.length; j += 1) bytes[j] = int(rng, 0, 255);
      try {
        const decoded = decodeManifest(bytes);
        expect(typeof decoded.manifest.type).toBe('string');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(TypeError);
        expect(error).not.toBeInstanceOf(RangeError);
      }
    }
  });

  it('rejects null and primitive JSON payloads', () => {
    const frame = (json: string): Uint8Array => {
      const body = new TextEncoder().encode(json);
      const out = new Uint8Array(6 + body.length);
      out[0] = 1;
      out[1] = 1;
      new DataView(out.buffer).setUint32(2, body.length, false);
      out.set(body, 6);
      return out;
    };
    for (const json of ['null', '"text"', '42', '[]', '{}']) {
      expect(() => decodeManifest(frame(json))).toThrow(Error);
    }
  });

  it('rejects invalid signature hex before encoding', () => {
    const rng = mulberry32(1);
    const signed = makeSigned(rng);
    signed.signature = 'not-hex';
    expect(() => encodeManifest(signed)).toThrow(/invalid hex/);
  });
});
