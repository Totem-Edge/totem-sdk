/**
 * OMN-022 — virtual-channel opens are rebuilt from the local factory. The
 * peer's plan is an assertion to verify, never the object that gets signed.
 */

import { buildVirtualChannelOpen } from '@totemsdk/omnia-factory';
import type { ChannelFactory, FactoryParticipant } from '@totemsdk/omnia-factory';
import { verifyVirtualChannelOpenPlan } from '../lifecycle.js';

const ALICE = '0x' + 'aa'.repeat(32);
const BOB = '0x' + 'bb'.repeat(32);

function participant(partyId: string, pkd: string): FactoryParticipant {
  return { partyId, publicKeyDigest: pkd, addressIndex: 0 } as FactoryParticipant;
}

function factory(): ChannelFactory {
  return {
    factoryId: 'f-vc',
    participants: [participant('alice', ALICE), participant('bob', BOB)],
    totalValue: 1000n,
    tokenId: '0x00',
    tokenScale: 0,
    allocations: { alice: 600n, bob: 400n },
    virtualChannels: [],
    currentSequence: 1,
    status: 'active',
    stateLog: [],
    fundingScript: 'RETURN TRUE',
    fundingAddress: '0x' + '11'.repeat(32),
    pendingCommitment: '0x' + '22'.repeat(32),
    pendingSignatures: {},
  } as unknown as ChannelFactory;
}

function plan(f: ChannelFactory, amounts: Record<string, bigint> = { alice: 300n, bob: 200n }) {
  return buildVirtualChannelOpen(f, ['alice', 'bob'], amounts, 'vc-1');
}

describe('OMN-022 virtual-channel plan binding', () => {
  it('accepts a peer plan whose commitment matches the local rebuild', () => {
    const f = factory();
    const local = plan(f);
    const verified = verifyVirtualChannelOpenPlan(f, {
      vcId: 'vc-1',
      plan: {
        vcId: 'vc-1',
        parties: ['alice', 'bob'],
        amounts: { alice: 300n, bob: 200n },
        commitment: '0x' + Buffer.from(local.commitment).toString('hex'),
      },
    });
    expect(verified.vcId).toBe('vc-1');
    expect(verified.amounts).toEqual({ alice: 300n, bob: 200n });
  });

  it('rejects altered amounts even when the peer carries a stale commitment', () => {
    const f = factory();
    const honest = plan(f);
    expect(() => verifyVirtualChannelOpenPlan(f, {
      vcId: 'vc-1',
      plan: {
        vcId: 'vc-1',
        parties: ['alice', 'bob'],
        amounts: { alice: 500n, bob: 0n },
        commitment: '0x' + Buffer.from(honest.commitment).toString('hex'),
      },
    })).toThrow(/does not match local factory state/);
  });

  it('rejects a missing or mismatched plan id', () => {
    const f = factory();
    expect(() => verifyVirtualChannelOpenPlan(f, { vcId: 'vc-1' })).toThrow(/incomplete/);
    expect(() => verifyVirtualChannelOpenPlan(f, {
      vcId: 'vc-2',
      plan: { vcId: 'vc-1', parties: ['alice', 'bob'], amounts: { alice: 300n, bob: 200n } },
    })).toThrow(/vcId does not match/);
  });

  it('rejects an open beyond the factory allocation', () => {
    const f = factory();
    const local = plan(f);
    expect(() => verifyVirtualChannelOpenPlan(f, {
      vcId: 'vc-1',
      plan: {
        vcId: 'vc-1',
        parties: ['alice', 'bob'],
        amounts: { alice: 700n, bob: 0n },
        commitment: '0x' + Buffer.from(local.commitment).toString('hex'),
      },
    })).toThrow(/insufficient allocation/);
  });
});
