/**
 * Deterministic channel-transition properties.
 *
 * Checks conservation/sequence validation and the replay/rollback watermark
 * used before WOTS signing. This is the pure transition layer; full signing is
 * covered by the channel/custody suites.
 */

import {
  validateStateTransition,
  enforceUpdateGuards,
  _resetChannelWatermarks,
  BalanceConservationError,
  SequenceError,
  DoubleSignError,
} from '../index';
import type { OmniaChannel } from '../index';

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

function channel(sequence: number): OmniaChannel {
  return {
    channelId: `ch-${int(mulberry32(sequence + 1), 1, 1_000_000)}`,
    fundingTxId: '0xtx',
    fundingCoinId: '0x' + 'aa'.repeat(32),
    fundingScript: 'RETURN TRUE',
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: 'Mx1',
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1000n,
    parties: [
      { partyId: 'alice', publicKeyDigest: '0x' + '11'.repeat(32), addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: '0x' + '22'.repeat(32), addressIndex: 1 },
    ],
    balances: { alice: 600n, bob: 400n },
    pendingHTLCs: [],
    currentSequence: sequence,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 0,
    updatedAt: 0,
  } as unknown as OmniaChannel;
}

describe('channel transition properties', () => {
  it('accepts exactly monotonic, conserving transitions', () => {
    const rng = mulberry32(0x51a7e);
    for (let i = 0; i < 1000; i += 1) {
      const current = int(rng, 0, 500);
      const ch = channel(current);
      const next = current + int(rng, -3, 6);
      const a = int(rng, 0, 1000);
      const balances = { alice: BigInt(a), bob: BigInt(1000 - a) };

      if (next <= current) {
        expect(() => validateStateTransition(ch, next, balances, 0n)).toThrow(SequenceError);
        continue;
      }

      const corrupt = rng() < 0.2;
      if (corrupt) {
        balances.bob += BigInt(int(rng, 1, 100));
        expect(() => validateStateTransition(ch, next, balances, 0n)).toThrow(BalanceConservationError);
      } else {
        expect(() => validateStateTransition(ch, next, balances, 0n)).not.toThrow();
      }
    }
  });

  it('rejects rollback and double-signs while allowing idempotent replay', () => {
    const rng = mulberry32(0xd0b1e);
    for (let i = 0; i < 200; i += 1) {
      _resetChannelWatermarks();
      const id = `ch-guard-${i}`;
      const sequence = int(rng, 1, 500);
      const payload = `payload-${int(rng, 0, 1_000_000)}`;

      expect(enforceUpdateGuards(id, sequence, payload)).toBeNull();
      // Idempotent replay of the same commitment is allowed.
      expect(enforceUpdateGuards(id, sequence, payload)).toBeNull();
      // Different commitment at the same sequence is a double-sign.
      expect(() => enforceUpdateGuards(id, sequence, `${payload}-x`)).toThrow(DoubleSignError);
      // Any lower sequence is a rollback.
      expect(() => enforceUpdateGuards(id, sequence - 1, payload)).toThrow(SequenceError);
      // A higher sequence is the next valid update.
      expect(enforceUpdateGuards(id, sequence + 1, `${payload}-next`)).toBeNull();
    }
  });
});
