/**
 * Deterministic property/fuzz tests for lookup-protocol framing.
 *
 * Seed is fixed so failures reproduce in CI. The target must either return a
 * LookupMessage or throw FramingError; arbitrary bytes must never escape as a
 * TypeError/RangeError.
 */

import {
  decodeMessage,
  encodeMessage,
  FramingError,
  MAX_FRAME_BODY_LENGTH,
} from '../framing';
import type { LookupMessage, MessageType } from '../messages';

const TYPES: MessageType[] = [
  'HELLO', 'SESSION_OPEN', 'SESSION_TICKET', 'SESSION_CLOSE',
  'WATCH_REGISTER', 'WATCH_REMOVE', 'GET_COINS', 'GET_COIN', 'GET_PROOF',
  'GET_TIP', 'GET_TOKEN', 'BROADCAST_TXPOW', 'COIN_UPDATE', 'PROOF_RESPONSE',
  'COINS_RESPONSE', 'COIN_RESPONSE', 'TIP_RESPONSE', 'TOKEN_RESPONSE',
  'BROADCAST_RESPONSE', 'LEASE_RESERVE', 'LEASE_COMMIT', 'LEASE_BURN',
  'LEASE_WATERMARK', 'LEASE_RESPONSE', 'APP_ANNOUNCE', 'APP_QUERY',
  'APP_RESULT', 'AGENT_ANNOUNCE', 'AGENT_QUERY', 'AGENT_RESULT',
  'TRUST_RECORD', 'TRUST_QUERY', 'TRUST_RESPONSE', 'POLICY_ANNOUNCE',
  'POLICY_QUERY', 'POLICY_RESULT', 'POLICY_WATCH', 'POLICY_UPDATE',
  'POLICY_SIGN_REQUEST', 'POLICY_SIGN_RESPONSE', 'POLICY_SIGN_CANCEL',
  'VERSION_MISMATCH', 'ERROR', 'PING', 'PONG',
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

function randomMessage(rng: () => number): LookupMessage {
  const msg = {
    type: pick(rng, TYPES),
    version: int(rng, 0, 2),
    ...(rng() < 0.6 ? { id: `id-${int(rng, 0, 100000)}` } : {}),
    payload: {
      n: int(rng, -1000, 1000),
      s: `s-${int(rng, 0, 100000)}`,
      flag: rng() < 0.5,
      bytes: randomBytes(rng, 32),
      nested: { ok: true, list: [int(rng, 0, 9), `v${int(rng, 0, 9)}`] },
    },
    ...(rng() < 0.25
      ? {
          auth: {
            rootPublicKey: `0x${'ab'.repeat(32)}`,
            signature: `0x${'cd'.repeat(64)}`,
            nonce: int(rng, 0, 1000000),
            expiresAt: int(rng, 0, 2000000000000),
            ...(rng() < 0.5 ? { rootIdentityProof: `proof-${int(rng, 0, 100)}` } : {}),
          },
        }
      : {}),
    ...(rng() < 0.25
      ? { ticket: { ticketId: `tkt-${int(rng, 0, 100000)}`, seq: int(rng, 0, 1000000) } }
      : {}),
  };
  return msg as unknown as LookupMessage;
}

function rawFrame(json: string): Uint8Array {
  const body = new TextEncoder().encode(json);
  const frame = new Uint8Array(4 + body.length);
  new DataView(frame.buffer).setUint32(0, body.length, false);
  frame.set(body, 4);
  return frame;
}

describe('lookup-protocol framing properties', () => {
  it('round-trips 500 generated messages', () => {
    const rng = mulberry32(0x5eed);
    for (let i = 0; i < 500; i += 1) {
      const msg = randomMessage(rng);
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    }
  });

  it('never exposes a non-FramingError for arbitrary bytes', () => {
    const rng = mulberry32(0xbadc0de);
    for (let i = 0; i < 2000; i += 1) {
      const bytes = randomBytes(rng, 512);
      try {
        const decoded = decodeMessage(bytes);
        expect(typeof decoded.type).toBe('string');
        expect(typeof decoded.version).toBe('number');
      } catch (error) {
        expect(error).toBeInstanceOf(FramingError);
      }
    }
  });

  it('rejects non-object JSON with FramingError', () => {
    expect(() => decodeMessage(rawFrame('null'))).toThrow(FramingError);
    expect(() => decodeMessage(rawFrame('"text"'))).toThrow(FramingError);
    expect(() => decodeMessage(rawFrame('42'))).toThrow(FramingError);
  });

  it('rejects an oversized declared body length before allocation', () => {
    const frame = new Uint8Array(4);
    new DataView(frame.buffer).setUint32(0, MAX_FRAME_BODY_LENGTH + 1, false);
    expect(() => decodeMessage(frame)).toThrow(FramingError);
  });

  it('rejects every truncation of a valid frame', () => {
    const frame = encodeMessage(randomMessage(mulberry32(1)));
    for (let cut = 0; cut < frame.length; cut += 1) {
      expect(() => decodeMessage(frame.slice(0, cut))).toThrow(FramingError);
    }
  });
});
