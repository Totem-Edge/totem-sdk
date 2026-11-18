/**
 * OMN-051 / OMN-052 / OMN-053 — splice transaction units, the added coin's
 * address, and the canonical witness.
 */

import { amountToAtoms, deserializeTransaction } from '@totemsdk/core';
import { buildSpliceTx, computeSpliceTxDigest, spliceDraftToMinimaBytes } from '../splice-tx.js';
import { finalizeSplice } from '../finalize.js';
import { acceptSplice, proposeSpliceIn } from '../splice.js';
import { quiesceChannel } from '../quiesce.js';
import type { OmniaChannel } from '@totemsdk/omnia';
import type { SpliceLeaseProvider } from '../types.js';

const COIN = '0x' + '44'.repeat(32);
const ADDRESS = 'Mx' + 'dd'.repeat(20);

function channel(overrides: Partial<OmniaChannel> = {}): OmniaChannel {
  return {
    channelId: '0x' + 'ab'.repeat(32),
    fundingTxId: '0x' + 'ef'.repeat(32),
    fundingCoinId: '0x' + 'cc'.repeat(32),
    fundingScript: 'RETURN TRUE',
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: '0x' + 'dd'.repeat(32),
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: amountToAtoms('1'),
    parties: [
      { partyId: 'alice', publicKeyDigest: '0x' + '11'.repeat(32), addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: '0x' + '22'.repeat(32), addressIndex: 1 },
    ],
    balances: { alice: amountToAtoms('0.6'), bob: amountToAtoms('0.4') },
    pendingHTLCs: [],
    currentSequence: 5,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as OmniaChannel;
}

function lease(pkd: string): SpliceLeaseProvider {
  let counter = 0;
  return {
    signer: { publicKeyDigest: pkd, sign: async (payload: Uint8Array) => payload },
    wotsLease: {
      reserveKeyUse: async () => ({
        reservationId: `r-${++counter}`,
        indices: { addressIndex: 0, l1: counter, l2: 0 },
        expiresAt: Date.now() + 60_000,
      }),
      commitKeyUse: async () => undefined,
      burnReservation: async () => undefined,
    },
  } as unknown as SpliceLeaseProvider;
}

describe('OMN-051 splice amounts are atoms at the boundary, decimal in the encoding', () => {
  it('round-trips a fractional splice-in through canonical MiniNumber encoding', () => {
    const ch = channel();
    const draft = buildSpliceTx(ch, {
      type: 'splice_in',
      additionalCoinId: COIN,
      additionalCoinAddress: ADDRESS,
      additionalAmount: amountToAtoms('0.2'),
      newTotalValue: amountToAtoms('1.2'),
      newBalances: { alice: amountToAtoms('0.7'), bob: amountToAtoms('0.5') },
    });
    const decoded = deserializeTransaction(spliceDraftToMinimaBytes(draft));
    expect(decoded.inputs[0]!.amount).toBe('1');
    expect(decoded.inputs[1]!.amount).toBe('0.2');
    expect(decoded.outputs[0]!.amount).toBe('1.2');
  });

  it('encodes whole amounts and custom tokens as decimal MINIMA', () => {
    const ch = channel({ tokenId: '0x' + 'aa'.repeat(32) });
    const draft = buildSpliceTx(ch, {
      type: 'splice_out',
      withdrawAmount: amountToAtoms('0.25'),
      withdrawAddress: ADDRESS,
      newTotalValue: amountToAtoms('0.75'),
      newBalances: { alice: amountToAtoms('0.5'), bob: amountToAtoms('0.25') },
    });
    const decoded = deserializeTransaction(spliceDraftToMinimaBytes(draft));
    expect(decoded.outputs[0]!.amount).toBe('0.75');
    expect(decoded.outputs[1]!.amount).toBe('0.25');
    expect(Buffer.from(decoded.outputs[1]!.tokenId).toString('hex')).toBe('aa'.repeat(32));
  });
});

describe('OMN-052 splice-in requires the added coin address', () => {
  it('rejects a splice-in draft without an address', () => {
    expect(() => buildSpliceTx(channel(), {
      type: 'splice_in',
      additionalCoinId: COIN,
      additionalAmount: amountToAtoms('0.2'),
      newTotalValue: amountToAtoms('1.2'),
      newBalances: { alice: amountToAtoms('0.7'), bob: amountToAtoms('0.5') },
    })).toThrow(/additional coin address/);
  });

  it('carries the address into the encoded input', () => {
    const draft = buildSpliceTx(channel(), {
      type: 'splice_in',
      additionalCoinId: COIN,
      additionalCoinAddress: ADDRESS,
      additionalAmount: amountToAtoms('0.2'),
      newTotalValue: amountToAtoms('1.2'),
      newBalances: { alice: amountToAtoms('0.7'), bob: amountToAtoms('0.5') },
    });
    expect(draft.inputs[1]!.address).toBe(ADDRESS);
    const decoded = deserializeTransaction(spliceDraftToMinimaBytes(draft));
    // The encoded address must be real coin data, not the empty placeholder.
    expect(decoded.inputs[1]!.address.length).toBeGreaterThan(0);
    expect(decoded.inputs[1]!.address).not.toEqual(decoded.inputs[0]!.address);
  });
});

describe('OMN-053 splice witness is canonical and proof-backed', () => {
  async function splice() {
    const ch = channel();
    const aliceLp = lease('0x' + '11'.repeat(32));
    const bobLp = lease('0x' + '22'.repeat(32));
    const q = await quiesceChannel(ch, aliceLp);
    const proposal = await proposeSpliceIn(
      q,
      COIN,
      amountToAtoms('0.2'),
      aliceLp,
      { alice: amountToAtoms('0.7'), bob: amountToAtoms('0.5') },
      ADDRESS,
    );
    const acceptance = await acceptSplice(q, proposal, bobLp, { verifySignature: () => true });
    return { q, proposal, acceptance };
  }

  it('refuses to broadcast without spending proofs', async () => {
    const { q, proposal, acceptance } = await splice();
    await expect(finalizeSplice(q, proposal, acceptance, {
      verifySignature: () => true,
      mineDifficulty: new Uint8Array(32).fill(0xff),
      broadcast: async () => ({ success: true, txpowid: '0x' + '77'.repeat(32) }),
    })).rejects.toThrow(/requires coin and script proofs/);
  });

  it('accepts a canonical witness when proofs are supplied', async () => {
    const { q, proposal, acceptance } = await splice();
    const broadcast = jest.fn(async () => ({ success: true, txpowid: '0x' + '77'.repeat(32) }));
    const spliced = await finalizeSplice(q, proposal, acceptance, {
      verifySignature: () => true,
      mineDifficulty: new Uint8Array(32).fill(0xff),
      broadcast,
      coinProofs: [new Uint8Array([1, 2, 3])],
      scriptProofs: [new Uint8Array([4, 5, 6])],
    });
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(spliced.spliceFundingTxId).toBe('0x' + '77'.repeat(32));
    // The digest both parties signed covers the corrected encoding.
    expect(computeSpliceTxDigest(proposal.spliceTxDraft)).toHaveLength(32);
  });
});
