import type { ChannelFactory } from '../types.js';
import { assertFactoryFinalized } from '../factory.js';

const PKD_A = '0x' + '11'.repeat(32);
const PKD_B = '0x' + '22'.repeat(32);
const SCRIPT = 'RETURN TRUE';
const ADDRESS = '0x' + '33'.repeat(32);

function base(over: Partial<ChannelFactory> = {}): ChannelFactory {
  return {
    factoryId: 'factory-1',
    participants: [
      { partyId: 'alice', publicKeyDigest: PKD_A, addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: PKD_B, addressIndex: 1 },
    ],
    totalValue: 200n,
    tokenId: '0x00',
    tokenScale: 0,
    allocations: { alice: 120n, bob: 80n },
    virtualChannels: [],
    currentSequence: 1,
    status: 'active',
    stateLog: [
      { sequence: 0, timestamp: 1, event: 'create', allocations: { alice: 120n, bob: 80n }, virtualChannelIds: [] },
      { sequence: 1, timestamp: 2, event: 'accept', allocations: { alice: 120n, bob: 80n }, virtualChannelIds: [] },
    ],
    fundingScript: SCRIPT,
    fundingAddress: ADDRESS,
    fundingTxId: '0xaaa',
    fundingCoinId: '0xbbb',
    pendingSignatures: {},
    ...over,
  } as ChannelFactory;
}

describe('assertFactoryFinalized (OMN-001)', () => {
  it('allows funding references to be filled on an active factory', () => {
    const known = base({ fundingTxId: undefined, fundingCoinId: undefined });
    const incoming = base({ fundingTxId: '0xccc', fundingCoinId: '0xddd' });
    const result = assertFactoryFinalized(known, incoming);
    expect(result.fundingTxId).toBe('0xccc');
    expect(result.fundingCoinId).toBe('0xddd');
  });

  it('rejects a peer that rewrites the active sequence, log, allocations or VC set', () => {
    const known = base();
    expect(() => assertFactoryFinalized(known, base({ currentSequence: 2 })))
      .toThrow(/changes the active sequence/);
    // Allocations and the VC set are part of the terms fingerprint, which is
    // checked before the transition-specific branches.
    expect(() => assertFactoryFinalized(known, base({ allocations: { alice: 0n, bob: 200n } })))
      .toThrow(/changes (factory terms|the active allocations)/);
    expect(() => assertFactoryFinalized(known, base({ virtualChannels: [{ channelId: 'vc-x' } as never] })))
      .toThrow(/changes (factory terms|the active virtual-channel set)/);
    expect(() => assertFactoryFinalized(known, base({
      stateLog: [...known.stateLog, { sequence: 2, timestamp: 3, event: 'dispute', allocations: { alice: 120n, bob: 80n }, virtualChannelIds: [] }],
    }))).toThrow(/changes the active state log/);
  });

  it('rejects pending opening state on an active factory', () => {
    const known = base();
    expect(() => assertFactoryFinalized(known, base({ pendingCommitment: 'ab'.repeat(32) })))
      .toThrow(/pending opening state/);
  });

  it('verifies every signature added to an opening', () => {
    const known = base({
      status: 'opening',
      currentSequence: 0,
      stateLog: [base().stateLog[0]!],
      pendingCommitment: 'ab'.repeat(32),
      pendingSignatures: {},
      fundingTxId: undefined,
      fundingCoinId: undefined,
    });
    expect(() => assertFactoryFinalized(known, {
      ...known,
      pendingSignatures: { alice: new Uint8Array(1088).fill(0x01) },
    })).toThrow(/invalid signature for 'alice'/);

    expect(() => assertFactoryFinalized(known, {
      ...known,
      pendingSignatures: { mallory: new Uint8Array(1088).fill(0x01) },
    })).toThrow(/unknown party 'mallory'/);
  });

  it('rejects removing a signature the host already holds', () => {
    const known = base({
      status: 'opening',
      currentSequence: 0,
      stateLog: [base().stateLog[0]!],
      pendingCommitment: 'ab'.repeat(32),
      pendingSignatures: { alice: new Uint8Array(1088).fill(0x02) },
      fundingTxId: undefined,
      fundingCoinId: undefined,
    });
    expect(() => assertFactoryFinalized(known, { ...known, pendingSignatures: {} }))
      .toThrow(/removes or alters the signature for 'alice'/);
  });
});
