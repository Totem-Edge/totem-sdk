/**
 * OMN-060 — factory funding seeds the party and balance roots its covenant
 * asserts.
 */

import { buildFactoryOpening, finalizeFactoryOpening } from '../factory.js';
import {
  computeFactoryBalanceRoot,
  computeFactoryPartyRoot,
  FACTORY_BALANCE_ROOT_PORT,
  FACTORY_PARTY_ROOT_PORT,
} from '../script.js';
import type { FactoryParticipant } from '../types.js';

const participants: FactoryParticipant[] = [
  { partyId: 'alice', publicKeyDigest: '0x' + '11'.repeat(32), addressIndex: 0, contributionAmount: 600n },
  { partyId: 'bob', publicKeyDigest: '0x' + '22'.repeat(32), addressIndex: 1, contributionAmount: 400n },
];

describe('OMN-060 factory commitment roots', () => {
  it('computes deterministic party and balance roots', () => {
    const party = computeFactoryPartyRoot(participants);
    const balance = computeFactoryBalanceRoot({ alice: 600n, bob: 400n });
    expect(party).toMatch(/^0x[0-9a-f]{64}$/);
    expect(balance).toMatch(/^0x[0-9a-f]{64}$/);
    // A different allocation is a different commitment.
    expect(computeFactoryBalanceRoot({ alice: 500n, bob: 500n })).not.toBe(balance);
    expect(computeFactoryPartyRoot([...participants].reverse())).toBe(party);
  });

  it('OMN-063: an unconfirmed factory funding stays opening', async () => {
    const fundingCoinIds = ['0x' + '11'.repeat(32), '0x' + '22'.repeat(32)];
    const materials = participants.map((p, index) => ({
      partyId: p.partyId,
      coinProof: new Uint8Array([index + 1]),
      scriptProof: new Uint8Array([index + 4]),
      coinAddress: '0x' + 'aa'.repeat(32),
    }));
    const plan = await buildFactoryOpening(
      participants.map((p, index) => ({ ...p, fundingCoinId: fundingCoinIds[index] })),
      '0x00',
      0,
      { getTip: async () => ({ block: 10, hash: '0x01' }) } as never,
      materials,
      1_000n,
    );
    expect(plan.onChain).toBe(true);

    const chainProvider = {
      submitTransaction: async () => ({ success: true, txpowid: '0x' + '77'.repeat(32) }),
      // Mined in the tip block: depth 1 only.
      getCoin: async () => ({ coinId: plan.fundingCoinId, amount: '1', spent: false, created: 10 }),
      getTip: async () => ({ block: 10, hash: '0x01' }),
    };
    const signature = new Uint8Array([1, 2, 3]);
    const factory = await finalizeFactoryOpening(plan, {
      fundingSignatures: { alice: signature, bob: signature },
      openingSignatures: { alice: signature, bob: signature },
      minConfirmations: 3,
    }, chainProvider as never);
    expect(factory.status).toBe('opening');
  });

  it('seeds both roots into the funding output', async () => {
    const chainProvider = {
      getTip: async () => ({ block: 100, hash: '0x01' }),
    } as never;
    const funding = participants.map((p) => ({
      partyId: p.partyId,
      coinAddress: '0x' + 'aa'.repeat(32),
      amount: p.contributionAmount,
    }));
    const plan = await buildFactoryOpening(
      participants.map((p, index) => ({ ...p, fundingCoinId: '0x' + String(index + 1).repeat(64) })),
      '0x00',
      0,
      chainProvider,
      funding as never,
      1_000n,
    );
    const ports = plan.fundingStateVariables ?? [];
    const byPort = new Map(ports.map((sv: any) => [sv.port, sv.value]));
    expect(byPort.get(FACTORY_PARTY_ROOT_PORT)).toBe(computeFactoryPartyRoot(participants));
    expect(byPort.get(FACTORY_BALANCE_ROOT_PORT)).toBe(
      computeFactoryBalanceRoot({ alice: 600n, bob: 400n }),
    );
  });
});
