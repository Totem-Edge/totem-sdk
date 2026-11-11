/**
 * RFC-078 — co-sign consent default and peer HTLC structural validation.
 */

import { defaultCoSignPolicy } from '../../../../../packages/omnia/src/integration.js';
import * as omniaEntry from '../../../../../packages/omnia/src/index.js';
import { validateStateForCoSign } from '../../../../../packages/omnia/src/sign.js';
import type { OmniaChannel, SignedChannelState } from '../../../../../packages/omnia/src/types.js';

const pkA = '0x' + '11'.repeat(32);
const pkB = '0x' + '22'.repeat(32);

function channel(): OmniaChannel {
  return {
    channelId: 'channel-1',
    fundingTxId: 'tx-1',
    fundingCoinId: 'coin-1',
    fundingScript: 'RETURN TRUE',
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: 'addr-1',
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1000n,
    parties: [
      { partyId: 'alice', publicKeyDigest: pkA, addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: pkB, addressIndex: 0 },
    ],
    balances: { alice: 600n, bob: 400n },
    pendingHTLCs: [],
    currentSequence: 0,
    onChainSequence: 0,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 1,
    updatedAt: 1,
  } as OmniaChannel;
}

function state(overrides: Partial<SignedChannelState> = {}): SignedChannelState {
  return {
    sequence: 1,
    balances: { alice: 600n, bob: 400n },
    pendingHTLCs: [],
    stateVariables: [],
    transactionHex: '0x',
    signatures: {},
    signingIndices: {},
    ...overrides,
  };
}

describe('RFC-078 co-sign hardening', () => {
  it('exposes the safe co-sign default from the package entry point', () => {
    // Applications must be able to reference the safe default through the
    // published entry point; integration.js is internal.
    expect(omniaEntry.defaultCoSignPolicy).toBe(defaultCoSignPolicy);
    expect(typeof omniaEntry.defaultCoSignPolicy.authorize).toBe('function');
  });

  it('denies a local balance decrease by default', async () => {
    const decision = await defaultCoSignPolicy.authorize({
      channel: channel(),
      state: state({ balances: { alice: 600n, bob: 400n } }),
      localPartyId: 'bob',
      localBalanceBefore: 400n,
      localBalanceAfter: 0n,
      addedHtlcIds: [],
      removedHtlcIds: [],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/balance would decrease/);
  });

  it('rejects negative and duplicate peer HTLCs structurally', () => {
    const negative = validateStateForCoSign(channel(), state({
      pendingHTLCs: [{
        htlcId: 'h1',
        amount: -100n,
        hashlock: '0x' + '00'.repeat(32),
        timeoutBlock: 10n,
        direction: 'offered',
        status: 'pending',
        htlcAddress: 'addr',
        senderPublicKeyDigest: pkA,
        recipientPublicKeyDigest: pkB,
      }],
    }));
    expect(negative.errors).toEqual(expect.arrayContaining([expect.stringMatching(/amount must be positive/)]));

    const duplicate = validateStateForCoSign(channel(), state({
      pendingHTLCs: [
        {
          htlcId: 'h1', amount: 10n, hashlock: '0x' + '00'.repeat(32), timeoutBlock: 10n,
          direction: 'offered', status: 'pending', htlcAddress: 'addr',
          senderPublicKeyDigest: pkA, recipientPublicKeyDigest: pkB,
        },
        {
          htlcId: 'h1', amount: 10n, hashlock: '0x' + '00'.repeat(32), timeoutBlock: 10n,
          direction: 'offered', status: 'pending', htlcAddress: 'addr',
          senderPublicKeyDigest: pkA, recipientPublicKeyDigest: pkB,
        },
      ],
    }));
    expect(duplicate.errors).toEqual(expect.arrayContaining([expect.stringMatching(/duplicate/)]));
  });
});
