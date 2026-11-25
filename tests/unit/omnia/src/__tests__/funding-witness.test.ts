import {
  createWalletFundingWitnessBuilder,
  type ChannelOpeningPlan,
  type ChannelSigner,
  type FundingProofProvider,
} from '../index';
import { createRelayOmniaOperations } from '../relay-client';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';

const DIGEST = new Uint8Array(32).fill(7);

function fakePlan(): ChannelOpeningPlan {
  return {
    channel: { channelId: '0xchannel' },
    fundingDigest: DIGEST,
    inputCoinId: '0xcoin',
  } as unknown as ChannelOpeningPlan;
}

function fakeLeaseProvider() {
  const reservations: Array<{ id: string; indices: unknown }> = [];
  const commits: string[] = [];
  const commitBindings: string[] = [];
  const burns: string[] = [];

  const provider = {
    async reserveKeyUse() {
      const reservation = {
        reservationId: `res-${reservations.length + 1}`,
        indices: { addressIndex: 0, l1: 1, l2: 2 },
        leaseToken: 'lease-token-1',
      };
      reservations.push({ id: reservation.reservationId, indices: reservation.indices });
      return reservation;
    },
    async commitKeyUse(reservationId: string, txId: string) {
      commits.push(reservationId);
      commitBindings.push(txId);
    },
    async burnReservation(reservationId: string) {
      burns.push(reservationId);
    },
  } as unknown as WotsLeaseProvider;

  return { provider, reservations, commits, commitBindings, burns };
}

function fakeProofs(): FundingProofProvider {
  return {
    async getCoinProof() {
      return new Uint8Array([1, 2, 3]);
    },
    async getFundingScript() {
      return 'RETURN TRUE';
    },
  };
}

describe('wallet funding witness builder', () => {
  test('signs the funding digest, commits the lease and returns witness bytes', async () => {
    const signed: Uint8Array[] = [];
    const signer: ChannelSigner = {
      publicKeyDigest: '0xsigner',
      async sign(payload) {
        signed.push(payload);
        return new Uint8Array([9, 9, 9]);
      },
    };
    const lease = fakeLeaseProvider();
    const builder = createWalletFundingWitnessBuilder({
      signer,
      leaseProvider: lease.provider,
      proofs: fakeProofs(),
    });

    const result = await builder.build({
      plan: fakePlan(),
      fundingCoinId: '0xcoin',
      localAmount: 10n,
      remoteAmount: 10n,
    });

    expect(signed).toHaveLength(1);
    expect(Buffer.from(signed[0]).equals(Buffer.from(DIGEST))).toBe(true);
    expect(lease.commits).toEqual(['res-1']);
    expect(lease.commitBindings).toEqual([Buffer.from(DIGEST).toString('hex')]);
    expect(lease.burns).toEqual([]);
    expect(result.fundingWitnessBytes.length).toBeGreaterThan(0);
  });

  test('passes the lease token to the coin-proof provider', async () => {
    const seen: Array<string | undefined> = [];
    const signer: ChannelSigner = {
      publicKeyDigest: '0xsigner',
      async sign() {
        return new Uint8Array([9]);
      },
    };
    const lease = fakeLeaseProvider();
    const builder = createWalletFundingWitnessBuilder({
      signer,
      leaseProvider: lease.provider,
      proofs: {
        async getCoinProof(_coinId, leaseToken) {
          seen.push(leaseToken);
          return new Uint8Array([1]);
        },
        async getFundingScript() {
          return 'RETURN TRUE';
        },
      },
    });

    await builder.build({
      plan: fakePlan(),
      fundingCoinId: '0xcoin',
      localAmount: 10n,
      remoteAmount: 10n,
    });

    expect(seen).toEqual(['lease-token-1']);
  });

  test('burns the lease when signing fails', async () => {
    const signer: ChannelSigner = {
      publicKeyDigest: '0xsigner',
      async sign() {
        throw new Error('signing rejected');
      },
    };
    const lease = fakeLeaseProvider();
    const builder = createWalletFundingWitnessBuilder({
      signer,
      leaseProvider: lease.provider,
      proofs: fakeProofs(),
    });

    await expect(
      builder.build({
        plan: fakePlan(),
        fundingCoinId: '0xcoin',
        localAmount: 10n,
        remoteAmount: 10n,
      }),
    ).rejects.toThrow('signing rejected');

    expect(lease.commits).toEqual([]);
    expect(lease.burns).toEqual(['res-1']);
  });
});

describe('relay openChannel witness boundary', () => {
  test('rejects a dApp-supplied fundingWitnessHex before building anything', async () => {
    const operations = createRelayOmniaOperations({
      swarm: {} as never,
      channels: new Map(),
      localParticipant: { partyId: 'local', publicKeyDigest: '0xlocal', addressIndex: 0 },
      signer: { publicKeyDigest: '0xlocal', sign: async () => new Uint8Array() },
      leaseProvider: fakeLeaseProvider().provider,
      chainProvider: {} as never,
    });

    await expect(
      operations.openChannel!({
        remotePartyId: 'remote',
        remotePublicKeyDigest: '0xremote',
        localAmount: '10',
        remoteAmount: '10',
        fundingCoinId: '0xcoin',
        fundingWitnessHex: '0xdeadbeef',
      }),
    ).rejects.toThrow(/fundingWitnessHex is not accepted/);
  });
});
