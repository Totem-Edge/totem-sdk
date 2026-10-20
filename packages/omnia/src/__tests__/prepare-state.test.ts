/**
 * RFC-058 P1 — prepare/sign/finalize channel updates without a host signature.
 */

import { bytesToHex, createUnifiedChildTreeKey, serializeTreeSignature } from '@totemsdk/core';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import { DefaultEltooPaymentProgram } from '../program.js';
import {
  finalizeStateUpdate,
  prepareStateUpdate,
  signState,
  verifyStateSignature,
} from '../sign.js';
import type { ChannelSigner, OmniaChannel, SignedChannelState } from '../types.js';

function makeLeaseProvider(): WotsLeaseProvider {
  let counter = 0;
  return {
    reserveKeyUse: async () => ({
      reservationId: `prepare-res-${++counter}`,
      indices: { addressIndex: 0, l1: counter, l2: 0 },
      expiresAt: Date.now() + 60_000,
    }),
    commitKeyUse: async () => {},
    burnReservation: async () => {},
    getLocalWatermark: async (treeId: string) => ({ treeId, addressCursor: 0, l1Cursor: 0, l2Cursor: 0, unavailableCount: 0, capacity: 4096 }),
    publishWatermark: async () => {},
    syncLeaseJournal: async () => ({ synced: true, conflicts: [] }),
    verifyLeaseCertificate: async () => true,
  } as unknown as WotsLeaseProvider;
}

function makeChannel(pkd: string): OmniaChannel {
  return {
    channelId: '0x' + 'ab'.repeat(32),
    fundingTxId: '0x' + 'ef'.repeat(32),
    fundingCoinId: '0x' + 'cc'.repeat(32),
    fundingScript: 'RETURN TRUE',
    programId: DefaultEltooPaymentProgram.id,
    programVersion: DefaultEltooPaymentProgram.version,
    fundingAddress: '0x' + 'dd'.repeat(32),
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1000n,
    parties: [
      { partyId: 'alice', publicKeyDigest: pkd, addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: '0x' + 'bb'.repeat(32), addressIndex: 1 },
    ],
    balances: { alice: 600n, bob: 400n },
    pendingHTLCs: [],
    currentSequence: 1,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 1_000,
    updatedAt: 1_000,
  };
}

describe('prepareStateUpdate / finalizeStateUpdate', () => {
  const treeKey = createUnifiedChildTreeKey(new Uint8Array(32).fill(7), 0);
  const pkd = `0x${bytesToHex(treeKey.getPublicKey()).toLowerCase()}`;
  const signer: ChannelSigner = {
    publicKeyDigest: pkd,
    async sign(payload, indices) {
      treeKey.setUses(indices.l1 * 64 + indices.l2);
      return serializeTreeSignature(treeKey.sign(payload)) as Uint8Array;
    },
  };

  it('prepares, signs and finalizes a channel update verifiably', async () => {
    const channel = makeChannel(pkd);
    const lease = makeLeaseProvider();
    const prepared = await prepareStateUpdate(
      channel,
      { newSequence: 2, newBalances: { alice: 500n, bob: 500n } },
      lease,
      signer,
    );

    expect(prepared.updateDigest).toHaveLength(32);
    expect(prepared.settlementDigest).toHaveLength(32);
    expect(prepared.updateReservation.indices).toBeDefined();

    const updateSig = await signer.sign(prepared.updateDigest, prepared.updateReservation.indices);
    const settlementSig = await signer.sign(prepared.settlementDigest, prepared.settlementReservation.indices);
    const state = finalizeStateUpdate(prepared, updateSig, settlementSig) as SignedChannelState;

    expect(state.sequence).toBe(2);
    expect(state.balances).toEqual({ alice: 500n, bob: 500n });
    expect(verifyStateSignature(channel, state, 'alice', pkd)).toBe(true);
  });

  it('signState remains equivalent to prepare + sign + finalize', async () => {
    const channel = makeChannel(pkd);
    const state = (await signState(
      channel,
      { newSequence: 2, newBalances: { alice: 500n, bob: 500n } },
      makeLeaseProvider(),
      signer,
    )) as SignedChannelState;

    expect(state.sequence).toBe(2);
    expect(verifyStateSignature(channel, state, 'alice', pkd)).toBe(true);
  });
});
