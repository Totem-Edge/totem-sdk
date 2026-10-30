/**
 * Deterministic property/fuzz tests for Omnia P2P framing.
 *
 * Covers bigint/Uint8Array round-trips, split frames, malformed JSON and
 * arbitrary bytes. The target must return a valid OmniaMessage or throw
 * FramingError; it must not leak TypeError/RangeError from the parser.
 */

import { FramingError } from '@totemsdk/lookup-protocol';
import { OmniaFrameParser, encodeOmniaMessage } from '../framing';
import type { OmniaMessage, OmniaMessageType } from '../messaging-types';

const TYPES: OmniaMessageType[] = [
  'CHANNEL_PROPOSAL', 'STATE_UPDATE', 'SETTLEMENT_PROPOSAL', 'ACK', 'ERROR',
  'FACTORY_PROPOSAL', 'FACTORY_ACCEPT', 'FACTORY_FUNDING_REQUEST',
  'FACTORY_FUNDING_RESPONSE', 'FACTORY_CLOSE_PROPOSAL', 'FACTORY_CLOSE_ACCEPT',
  'FACTORY_CLOSE_FINALIZED', 'FACTORY_FINALIZED', 'VC_PROPOSAL', 'VC_ACCEPT',
  'VC_FINALIZED', 'SPLICE_PROPOSAL', 'SPLICE_ACCEPT', 'SPLICE_FINALIZED',
];

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

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[int(rng, 0, values.length - 1)];
}

function randomBytes(rng: () => number, max: number): Uint8Array {
  const out = new Uint8Array(int(rng, 0, max));
  for (let i = 0; i < out.length; i += 1) out[i] = int(rng, 0, 255);
  return out;
}

function randomMessage(rng: () => number): OmniaMessage {
  return {
    type: pick(rng, TYPES),
    channelId: `ch-${int(rng, 0, 100000)}`,
    nonce: int(rng, 0, 1000000),
    ...(rng() < 0.25 ? { version: int(rng, 0, 2) } : {}),
    ...(rng() < 0.25 ? { correlationId: `corr-${int(rng, 0, 100000)}` } : {}),
    payload: {
      amount: BigInt(int(rng, 0, 1_000_000)),
      nested: {
        amount: BigInt(int(rng, 0, 1_000_000)),
        bytes: randomBytes(rng, 32),
        flag: rng() < 0.5,
      },
      list: [BigInt(int(rng, 0, 9)), `v${int(rng, 0, 9)}`],
    },
  };
}

function rawFrame(json: string): Uint8Array {
  const body = new TextEncoder().encode(json);
  const frame = new Uint8Array(4 + body.length);
  new DataView(frame.buffer).setUint32(0, body.length, false);
  frame.set(body, 4);
  return frame;
}

describe('Omnia framing properties', () => {
  it('round-trips 500 generated messages with bigint and bytes', () => {
    const rng = mulberry32(0x0a11a);
    for (let i = 0; i < 500; i += 1) {
      const msg = randomMessage(rng);
      const decoded = new OmniaFrameParser().push(encodeOmniaMessage(msg));
      expect(decoded).toHaveLength(1);
      expect(decoded[0]).toEqual(msg);
    }
  });

  it('reassembles every split point of a generated frame', () => {
    const rng = mulberry32(0x5b17);
    for (let i = 0; i < 100; i += 1) {
      const msg = randomMessage(rng);
      const frame = encodeOmniaMessage(msg);
      const cut = int(rng, 0, frame.length - 1);
      const parser = new OmniaFrameParser();
      expect(parser.push(frame.slice(0, cut))).toHaveLength(0);
      const decoded = parser.push(frame.slice(cut));
      expect(decoded).toHaveLength(1);
      expect(decoded[0]).toEqual(msg);
    }
  });

  it('never exposes a non-FramingError for arbitrary bytes', () => {
    const rng = mulberry32(0xbad0b);
    for (let i = 0; i < 2000; i += 1) {
      const parser = new OmniaFrameParser();
      try {
        const decoded = parser.push(randomBytes(rng, 512));
        for (const msg of decoded) {
          expect(typeof msg.type).toBe('string');
          expect(typeof msg.channelId).toBe('string');
          expect(typeof msg.nonce).toBe('number');
        }
      } catch (error) {
        expect(error).toBeInstanceOf(FramingError);
      }
    }
  });

  it('rejects non-object and wrong-shape JSON with FramingError', () => {
    for (const json of ['null', '"text"', '42', '{}', '{"type":"ACK"}']) {
      expect(() => new OmniaFrameParser().push(rawFrame(json))).toThrow(FramingError);
    }
  });

  it('does not coerce a non-string bigint sentinel', () => {
    const frame = rawFrame(
      JSON.stringify({
        type: 'ACK',
        channelId: 'c1',
        nonce: 1,
        payload: { amount: { __bigint: 1 } },
      }),
    );
    const decoded = new OmniaFrameParser().push(frame);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].payload).toEqual({ amount: { __bigint: 1 } });
  });
});
