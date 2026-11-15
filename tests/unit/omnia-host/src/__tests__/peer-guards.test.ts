import type { ChannelFactory } from '@totemsdk/omnia-factory';
import type { SpliceAcceptance } from '@totemsdk/omnia-splice';
import type { OmniaChannel } from '@totemsdk/omnia';
import {
  assertSpliceFinalized,
  assertVcFinalized,
  resolveFactoryFundingTarget,
  type PendingVcAcceptance,
} from '../peer-guards.js';

const PKD_A = '0x' + '11'.repeat(32);
const PKD_B = '0x' + '22'.repeat(32);
const DIGEST = 'ab'.repeat(32);
const SPLICE_ID = 'splice-1';
const CHANNEL_ID = 'channel-1';

function factory(over: Partial<ChannelFactory> = {}): ChannelFactory {
  return {
    factoryId: 'factory-1',
    pendingCommitment: DIGEST,
    currentSequence: 4,
    participants: [
      { partyId: 'A', publicKeyDigest: PKD_A, addressIndex: 0, settlementAddress: '0x1' },
      { partyId: 'B', publicKeyDigest: PKD_B, addressIndex: 0, settlementAddress: '0x2' },
    ],
    virtualChannels: [],
    ...over,
  } as unknown as ChannelFactory;
}

function acceptance(over: Partial<SpliceAcceptance> = {}): SpliceAcceptance {
  return {
    spliceId: SPLICE_ID,
    channelId: CHANNEL_ID,
    acceptorPublicKeyDigest: PKD_B,
    acceptorSignature: {} as SpliceAcceptance['acceptorSignature'],
    acceptorReservationId: 'reservation-1',
    acceptorSigningIndices: { addressIndex: 0, l1: 0, l2: 0 },
    acceptedAt: 1,
    ...over,
  } as SpliceAcceptance;
}

function channel(over: Record<string, unknown> = {}): OmniaChannel {
  return {
    channelId: CHANNEL_ID,
    splicedFrom: CHANNEL_ID,
    spliceFundingTxId: '0xdeadbeef',
    ...over,
  } as unknown as OmniaChannel;
}

// ─── CAN-010: factory funding requests ──────────────────────────────────────

describe('resolveFactoryFundingTarget (CAN-010)', () => {
  it('accepts the funding digest of a factory this host already holds', () => {
    const factories = new Map([['factory-1', factory()]]);
    const target = resolveFactoryFundingTarget(factories, '0x' + DIGEST, PKD_B);
    expect(target.factoryId).toBe('factory-1');
  });

  it('rejects an arbitrary digest that matches no accepted factory', () => {
    const factories = new Map([['factory-1', factory()]]);
    expect(() => resolveFactoryFundingTarget(factories, '0x' + 'cd'.repeat(32), PKD_B))
      .toThrow(/does not match any locally accepted factory/);
  });

  it('rejects a request from a party that is not a factory participant', () => {
    const factories = new Map([['factory-1', factory()]]);
    expect(() => resolveFactoryFundingTarget(factories, DIGEST, '0x' + '99'.repeat(32)))
      .toThrow(/not a factory participant/);
  });

  it('rejects a request with no authenticated peer identity', () => {
    const factories = new Map([['factory-1', factory()]]);
    expect(() => resolveFactoryFundingTarget(factories, DIGEST, undefined))
      .toThrow(/no authenticated peer identity/);
  });

  it('refuses to choose when two factories share a commitment', () => {
    const factories = new Map([
      ['factory-1', factory()],
      ['factory-2', factory({ factoryId: 'factory-2' })],
    ]);
    expect(() => resolveFactoryFundingTarget(factories, DIGEST, PKD_B))
      .toThrow(/ambiguous/);
  });

  it('ignores factories with no pending commitment', () => {
    const factories = new Map([['factory-1', factory({ pendingCommitment: undefined })]]);
    expect(() => resolveFactoryFundingTarget(factories, DIGEST, PKD_B)).toThrow(/does not match/);
  });
});

// ─── CAN-007: splice finalization ───────────────────────────────────────────

describe('assertSpliceFinalized (CAN-007)', () => {
  const acceptances = new Map([[SPLICE_ID, acceptance()]]);

  it('accepts a finalization that matches the local acceptance', () => {
    const { channel: finalized } = assertSpliceFinalized(acceptances, {
      spliceId: SPLICE_ID,
      txId: '0xdeadbeef',
      channel: channel(),
    });
    expect(finalized.channelId).toBe(CHANNEL_ID);
  });

  it('rejects a splice this host never accepted', () => {
    expect(() => assertSpliceFinalized(acceptances, {
      spliceId: 'unknown-splice',
      channel: channel(),
    })).toThrow(/no matching local acceptance/);
  });

  it('rejects a finalization for a different channel', () => {
    expect(() => assertSpliceFinalized(acceptances, {
      spliceId: SPLICE_ID,
      channel: channel({ channelId: 'other-channel', splicedFrom: 'other-channel' }),
    })).toThrow(/does not match the channel that was accepted/);
  });

  it('rejects a channel that was not spliced from the accepted channel', () => {
    expect(() => assertSpliceFinalized(acceptances, {
      spliceId: SPLICE_ID,
      channel: channel({ splicedFrom: 'somewhere-else' }),
    })).toThrow(/was not spliced from the accepted channel/);
  });

  it('rejects a txId that contradicts the channel funding transaction', () => {
    expect(() => assertSpliceFinalized(acceptances, {
      spliceId: SPLICE_ID,
      txId: '0xfeedface',
      channel: channel(),
    })).toThrow(/does not match the channel funding transaction/);
  });

  it('rejects a finalization with no channel or no spliceId', () => {
    expect(() => assertSpliceFinalized(acceptances, { spliceId: SPLICE_ID }))
      .toThrow(/without a channel/);
    expect(() => assertSpliceFinalized(acceptances, { channel: channel() }))
      .toThrow(/without a spliceId/);
  });
});

// ─── CAN-007: virtual-channel finalization ──────────────────────────────────

describe('assertVcFinalized (CAN-007)', () => {
  const pending = (over: Partial<PendingVcAcceptance> = {}): Map<string, PendingVcAcceptance> =>
    new Map([['vc-1', { kind: 'vc-open', factoryId: 'factory-1', localPartyId: 'B', ...over }]]);

  it('accepts a vc-open that is the successor of the local factory', () => {
    const result = assertVcFinalized({
      acceptances: pending(),
      factories: new Map([['factory-1', factory()]]),
      hasChannel: () => false,
      payload: {
        kind: 'vc-open',
        factory: factory({
          currentSequence: 5,
          virtualChannels: [{ channelId: 'vc-1' } as never],
        }),
        channel: { channelId: 'vc-1' } as OmniaChannel,
      },
    });
    expect(result.factoryId).toBe('factory-1');
  });

  it('rejects a VC this host never co-signed', () => {
    expect(() => assertVcFinalized({
      acceptances: new Map(),
      factories: new Map([['factory-1', factory()]]),
      hasChannel: () => true,
      payload: { kind: 'vc-close', factory: factory({ currentSequence: 5 }), channelId: 'vc-1' },
    })).toThrow(/no matching local acceptance/);
  });

  it('rejects a kind that does not match the accepted proposal', () => {
    expect(() => assertVcFinalized({
      acceptances: pending({ kind: 'vc-open' }),
      factories: new Map([['factory-1', factory()]]),
      hasChannel: () => true,
      payload: { kind: 'vc-close', factory: factory({ currentSequence: 5 }), channelId: 'vc-1' },
    })).toThrow(/does not match the accepted proposal/);
  });

  it('rejects a factory the host does not hold', () => {
    expect(() => assertVcFinalized({
      acceptances: pending(),
      factories: new Map(),
      hasChannel: () => false,
      payload: {
        kind: 'vc-open',
        factory: factory({ currentSequence: 5, virtualChannels: [{ channelId: 'vc-1' } as never] }),
        channel: { channelId: 'vc-1' } as OmniaChannel,
      },
    })).toThrow(/which this host does not hold/);
  });

  it('rejects a factory state that is not a single-sequence successor', () => {
    expect(() => assertVcFinalized({
      acceptances: pending(),
      factories: new Map([['factory-1', factory()]]),
      hasChannel: () => false,
      payload: {
        kind: 'vc-open',
        factory: factory({ currentSequence: 9, virtualChannels: [{ channelId: 'vc-1' } as never] }),
        channel: { channelId: 'vc-1' } as OmniaChannel,
      },
    })).toThrow(/is not the successor/);
  });

  it('rejects a vc-open whose finalized factory does not contain the channel', () => {
    expect(() => assertVcFinalized({
      acceptances: pending(),
      factories: new Map([['factory-1', factory()]]),
      hasChannel: () => false,
      payload: {
        kind: 'vc-open',
        factory: factory({ currentSequence: 5, virtualChannels: [] }),
        channel: { channelId: 'vc-1' } as OmniaChannel,
      },
    })).toThrow(/does not contain/);
  });

  it('rejects a vc-close for a channel the host does not have', () => {
    expect(() => assertVcFinalized({
      acceptances: pending({ kind: 'vc-close' }),
      factories: new Map([['factory-1', factory()]]),
      hasChannel: () => false,
      payload: { kind: 'vc-close', factory: factory({ currentSequence: 5 }), channelId: 'vc-1' },
    })).toThrow(/closes a channel this host does not hold/);
  });
});
