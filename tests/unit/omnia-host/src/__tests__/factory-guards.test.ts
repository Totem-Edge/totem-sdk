/**
 * Peer-supplied factory state must be verified, not trusted.
 *
 * CAN-018/CAN-020 regression coverage: off-chain proposals are bound by their
 * state commitment, and FACTORY_FINALIZED may only apply the deterministic
 * open->active commit — never replace terms, balances or funding references.
 */

import os from 'node:os';
import { assertFactoryFinalized, buildFactorySettlement, computeFactoryStateCommitment } from '@totemsdk/omnia-factory';
import type { ChannelFactory, FactoryParticipant } from '@totemsdk/omnia-factory';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';
import { assertFactorySettlementDraft, assertOffChainFactoryCommitment } from '../peer-guards.js';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const hex = (u8: Uint8Array) => '0x' + Buffer.from(u8).toString('hex');

const ALICE_SEED = '0x' + 'ab'.repeat(32);
const BOB_SEED = '0x' + 'cd'.repeat(32);

function makeSigning(seed: string, name: string) {
  return createHostSigning(loadConfigFromEnv({
    OMNIA_HOST_SEED: seed,
    OMNIA_HOST_DB: `${os.tmpdir()}/omnia-factory-guard-${name}-${suffix}.sqlite`,
  }));
}

function makeFactory(alice: FactoryParticipant, bob: FactoryParticipant, commitment: Uint8Array): ChannelFactory {
  return {
    factoryId: 'f1',
    participants: [alice, bob],
    totalValue: 1000n,
    tokenId: '0x00',
    tokenScale: 0,
    allocations: { alice: 600n, bob: 400n },
    virtualChannels: [],
    currentSequence: 0,
    status: 'opening',
    stateLog: [{
      sequence: 0,
      timestamp: 1,
      event: 'create',
      allocations: { alice: 600n, bob: 400n },
      virtualChannelIds: [],
    }],
    fundingScript: 'RETURN TRUE',
    fundingAddress: '0x' + '11'.repeat(32),
    pendingCommitment: hex(commitment),
    pendingSignatures: {},
  } as ChannelFactory;
}

describe('off-chain factory proposal commitment', () => {
  it('accepts a commitment that matches the terms and rejects altered balances', () => {
    const allocations = { alice: 600n, bob: 400n };
    const commitment = computeFactoryStateCommitment('offchain-1', 1, allocations, []);
    const factory = {
      factoryId: 'offchain-1',
      participants: [],
      totalValue: 1000n,
      tokenId: '0x00',
      tokenScale: 0,
      allocations,
      virtualChannels: [],
      currentSequence: 0,
      status: 'opening',
      stateLog: [],
      fundingScript: 'RETURN TRUE',
      fundingAddress: '0x' + '11'.repeat(32),
      pendingCommitment: hex(commitment),
      pendingSignatures: {},
    } as unknown as ChannelFactory;

    expect(() => assertOffChainFactoryCommitment(factory)).not.toThrow();

    const altered = { ...factory, allocations: { alice: 900n, bob: 100n } };
    expect(() => assertOffChainFactoryCommitment(altered)).toThrow(/commitment does not match|conservation/);
  });
});

describe('FACTORY_FINALIZED guard', () => {
  it('accepts the deterministic open->active commit and rejects term replacement', async () => {
    const aliceSigning = makeSigning(ALICE_SEED, 'alice');
    const bobSigning = makeSigning(BOB_SEED, 'bob');
    const alice: FactoryParticipant = {
      partyId: 'alice', publicKeyDigest: aliceSigning.publicKeyDigest, addressIndex: 0, contributionAmount: 600n,
    };
    const bob: FactoryParticipant = {
      partyId: 'bob', publicKeyDigest: bobSigning.publicKeyDigest, addressIndex: 1, contributionAmount: 400n,
    };
    const commitment = new Uint8Array(32).fill(7);
    const indices = { addressIndex: 0, l1: 0, l2: 0 };
    const known = makeFactory(alice, bob, commitment);
    known.pendingSignatures = {
      alice: await aliceSigning.signer.sign(commitment, indices),
      bob: await bobSigning.signer.sign(commitment, indices),
    };

    const committed: ChannelFactory = {
      ...known,
      status: 'active',
      currentSequence: 1,
      pendingCommitment: undefined,
      pendingSignatures: {},
      fundingTxId: 'tx-1',
      fundingCoinId: '0x' + '22'.repeat(32),
      stateLog: [
        ...known.stateLog,
        {
          sequence: 1,
          timestamp: 2,
          event: 'accept',
          allocations: { alice: 600n, bob: 400n },
          virtualChannelIds: [],
        },
      ],
    };

    const validated = assertFactoryFinalized(known, committed, bob.publicKeyDigest);
    expect(validated.status).toBe('active');
    expect(validated.fundingTxId).toBe('tx-1');

    const altered = {
      ...committed,
      allocations: { alice: 900n, bob: 100n },
    };
    expect(() => assertFactoryFinalized(known, altered, bob.publicKeyDigest)).toThrow(/changes factory terms/);

    expect(() => assertFactoryFinalized(known, committed, '0x' + 'ff'.repeat(32)))
      .toThrow(/sender is not a factory participant/);

    const missingSignature = { ...known, pendingSignatures: { alice: known.pendingSignatures.alice } };
    expect(() => assertFactoryFinalized(missingSignature, committed, bob.publicKeyDigest))
      .toThrow(/missing the signature/);

    const invalidSignature = {
      ...known,
      pendingSignatures: { ...known.pendingSignatures, bob: new Uint8Array(64) },
    };
    expect(() => assertFactoryFinalized(invalidSignature, committed, bob.publicKeyDigest))
      .toThrow(/invalid signature/);
  });
});


describe('factory close draft guard', () => {
  it('signs only the settlement rebuilt from the local factory', () => {
    const alice: FactoryParticipant = {
      partyId: 'alice', publicKeyDigest: '0x' + 'aa'.repeat(32), addressIndex: 0,
      contributionAmount: 600n, settlementAddress: '0x' + 'a1'.repeat(32),
    };
    const bob: FactoryParticipant = {
      partyId: 'bob', publicKeyDigest: '0x' + 'bb'.repeat(32), addressIndex: 1,
      contributionAmount: 400n, settlementAddress: '0x' + 'b2'.repeat(32),
    };
    const factory = {
      factoryId: 'close-1',
      participants: [alice, bob],
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
      fundingCoinId: '0x' + '33'.repeat(32),
      pendingSignatures: {},
    } as unknown as ChannelFactory;

    const expected = buildFactorySettlement(factory);
    expect(() => assertFactorySettlementDraft(expected, expected)).not.toThrow();

    expect(() => assertFactorySettlementDraft(expected, {
      ...expected,
      settlementTxHex: '0x' + 'de'.repeat(8),
    })).toThrow(/transaction does not match/);

    expect(() => assertFactorySettlementDraft(expected, {
      ...expected,
      txDigest: new Uint8Array(32),
    })).toThrow(/digest does not match/);

    const alteredDraft = {
      ...expected,
      settlementDraft: {
        ...(expected.settlementDraft as unknown as Record<string, unknown>),
        outputs: [],
      },
    };
    expect(() => assertFactorySettlementDraft(expected, alteredDraft)).toThrow(/draft does not match/);
  });
});
