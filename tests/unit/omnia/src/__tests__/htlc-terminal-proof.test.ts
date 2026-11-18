/**
 * OMN-061 — a pending HTLC cannot become terminal without proof.
 */

import { sha3_256 } from '@totemsdk/core';
import { validateStateForCoSign } from '../sign.js';
import type { HTLCRecord, OmniaChannel, SignedChannelState } from '../types.js';

const ALICE = '0x' + '11'.repeat(32);
const BOB = '0x' + '22'.repeat(32);

function htlc(hashlock: string): HTLCRecord {
  return {
    htlcId: 'htlc-1',
    amount: 100n,
    hashlock,
    timeoutBlock: 500n,
    direction: 'offered',
    status: 'pending',
    htlcAddress: '0x' + '33'.repeat(32),
    senderPublicKeyDigest: ALICE,
    recipientPublicKeyDigest: BOB,
  };
}

function channel(hashlock: string): OmniaChannel {
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
    totalValue: 1000n,
    parties: [
      { partyId: 'alice', publicKeyDigest: ALICE, addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: BOB, addressIndex: 1 },
    ],
    balances: { alice: 550n, bob: 350n },
    pendingHTLCs: [htlc(hashlock)],
    currentSequence: 3,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 1,
    updatedAt: 1,
  } as OmniaChannel;
}

function state(status: HTLCRecord['status'], hashlock: string): SignedChannelState {
  return {
    sequence: 4,
    // The attack: alice's balance is unchanged and bob is credited the HTLC.
    balances: { alice: 550n, bob: 450n },
    pendingHTLCs: [{ ...htlc(hashlock), status }],
    stateVariables: [],
    transactionHex: '0x',
    signatures: {},
    signingIndices: {},
  } as unknown as SignedChannelState;
}

const PREIMAGE = '0x' + 'ab'.repeat(32);
const HASHLOCK = '0x' + Buffer.from(sha3_256(Uint8Array.from(Buffer.from(PREIMAGE.slice(2), 'hex')))).toString('hex');

describe('OMN-061 HTLC terminal transitions need proof', () => {
  it('rejects pending → fulfilled without a preimage', () => {
    const result = validateStateForCoSign(channel(HASHLOCK), state('fulfilled', HASHLOCK));
    expect(result.errors.join('; ')).toMatch(/cannot be fulfilled without a revealed preimage/);
  });

  it('rejects a preimage that does not match the hashlock', () => {
    const result = validateStateForCoSign(channel(HASHLOCK), state('fulfilled', HASHLOCK), {
      preimage: '0x' + 'cd'.repeat(32),
    });
    expect(result.errors.join('; ')).toMatch(/preimage does not match/);
  });

  it('accepts the matching preimage', () => {
    const result = validateStateForCoSign(channel(HASHLOCK), state('fulfilled', HASHLOCK), {
      preimage: PREIMAGE,
    });
    expect(result.errors.join('; ')).not.toMatch(/preimage/);
  });

  it('rejects pending → timed_out without an authoritative height', () => {
    const result = validateStateForCoSign(channel(HASHLOCK), state('timed_out', HASHLOCK));
    expect(result.errors.join('; ')).toMatch(/without authoritative chain height/);
  });

  it('rejects a timeout before the HTLC deadline', () => {
    const result = validateStateForCoSign(channel(HASHLOCK), state('timed_out', HASHLOCK), {
      chainHeight: 499,
    });
    expect(result.errors.join('; ')).toMatch(/timed out before block 500/);
  });

  it('accepts a timeout at or after the deadline', () => {
    const result = validateStateForCoSign(channel(HASHLOCK), state('timed_out', HASHLOCK), {
      chainHeight: 500,
    });
    expect(result.errors.join('; ')).not.toMatch(/timed out/);
  });
});
