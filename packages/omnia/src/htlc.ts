import { HTLCHelper, bytesToHex } from '@totemsdk/core';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type {
  OmniaChannel,
  HTLCRecord,
  AddHTLCParams,
  SignedChannelState,
  ChannelSigner,
} from './types.js';
import { ChannelStatusError, BalanceConservationError, SigningIndexMonotonicityError } from './errors.js';
import { signState } from './sign.js';
import { computeStateCommitment } from './transactions.js';
import { enforceUpdateGuards } from './channel.js';
import { flatSigningIndex } from './capacity.js';

function generateHtlcId(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return '0x' + buf.reduce((hex, b) => hex + b.toString(16).padStart(2, '0'), '');
}

/**
 * Adds a Hash Time-Locked Contract as a conditional output in the next state update.
 *
 * Spec: `addHTLC(channel, htlcParams, leaseProvider)` — signer is optional, falls back
 * to `channel.localSigner`.
 */
export async function addHTLC(
  channel: OmniaChannel,
  params: AddHTLCParams,
  leaseProvider: WotsLeaseProvider,
  signer?: ChannelSigner,
): Promise<{ channel: OmniaChannel; htlcId: string; partialState: Partial<SignedChannelState>; error?: string }> {
  if (channel.status !== 'active') {
    throw new ChannelStatusError('active', channel.status);
  }

  const effectiveSigner = signer ?? channel.localSigner;
  if (!effectiveSigner) throw new Error('No signer provided and channel.localSigner is not set');

  const offererPartyId = channel.parties.find(
    p => p.publicKeyDigest === effectiveSigner.publicKeyDigest
  )?.partyId;
  if (!offererPartyId) throw new Error('Signer is not a channel participant');

  const offererBalance = channel.balances[offererPartyId] ?? 0n;
  if (params.amount <= 0n) {
    throw new Error(`HTLC amount must be positive: ${params.amount}`);
  }
  if (params.amount > offererBalance) {
    throw new Error(`Insufficient balance: ${offererBalance} < ${params.amount}`);
  }

  const counterParty = channel.parties.find(p => p.publicKeyDigest !== effectiveSigner.publicKeyDigest);
  if (!counterParty) throw new Error('Counter party not found');

  const { script: htlcScript, address: htlcAddress } = HTLCHelper.createHTLC(
    effectiveSigner.publicKeyDigest,
    params.counterpartPublicKeyDigest,
    params.hashlock,
    params.timeoutBlock,
  );

  const htlcRecord: HTLCRecord = {
    htlcId: generateHtlcId(),
    amount: params.amount,
    hashlock: params.hashlock,
    timeoutBlock: params.timeoutBlock,
    direction: params.direction,
    status: 'pending',
    htlcAddress,
    senderPublicKeyDigest: effectiveSigner.publicKeyDigest,
    recipientPublicKeyDigest: params.counterpartPublicKeyDigest,
  };

  const newBalances: Record<string, bigint> = { ...channel.balances };
  newBalances[offererPartyId] = offererBalance - params.amount;

  const newHTLCs = [...channel.pendingHTLCs, htlcRecord];
  const newSequence = channel.currentSequence + 1;

  const htlcTotal = newHTLCs.filter(h => h.status === 'pending').reduce((a, h) => a + h.amount, 0n);
  const balanceSum = Object.values(newBalances).reduce((a, b) => a + b, 0n);
  if (balanceSum + htlcTotal !== channel.totalValue) {
    throw new BalanceConservationError(channel.totalValue, balanceSum + htlcTotal);
  }
  for (const [partyId, balance] of Object.entries(newBalances)) {
    if (balance < 0n) {
      throw new Error(`Negative balance for ${partyId}: ${balance}`);
    }
  }

  // ── Shared update guards (capacity, watermark double-sign/stale-sequence) ──
  const commitment = computeStateCommitment(newSequence, newBalances, newHTLCs);
  const payloadHash = bytesToHex(commitment);
  const guardError = enforceUpdateGuards(channel.channelId, newSequence, payloadHash, channel.pendingProposal);
  if (guardError) {
    return { channel, htlcId: htlcRecord.htlcId, partialState: {}, error: guardError };
  }

  const channelWithHTLC: OmniaChannel = {
    ...channel,
    pendingHTLCs: newHTLCs,
    pendingProposal: { sequence: newSequence, payloadHash },
  };

  const partialState = await signState(
    channelWithHTLC,
    { newSequence, newBalances },
    leaseProvider,
    effectiveSigner,
  );

  // Signing-index monotonicity: new flat index must exceed the previous one.
  const signerIndices = partialState.signingIndices![offererPartyId];
  if (channel.latestState) {
    const prevIndices = channel.latestState.signingIndices[offererPartyId];
    if (prevIndices) {
      const prevFlat = flatSigningIndex(prevIndices.l1, prevIndices.l2);
      const newFlat = flatSigningIndex(signerIndices.l1, signerIndices.l2);
      if (newFlat <= prevFlat) {
        throw new SigningIndexMonotonicityError(offererPartyId, prevFlat, newFlat);
      }
    }
  }

  const updatedChannel: OmniaChannel = {
    ...channel,
    balances: newBalances,
    pendingHTLCs: newHTLCs,
    currentSequence: newSequence,
    updatedAt: Date.now(),
    stateLog: [
      ...channel.stateLog,
      {
        sequence: newSequence,
        timestamp: Date.now(),
        balances: { ...newBalances },
        htlcCount: newHTLCs.filter(h => h.status === 'pending').length,
        event: 'htlc_add',
      },
    ],
  };

  return { channel: updatedChannel, htlcId: htlcRecord.htlcId, partialState };
}

/**
 * Recipient reveals preimage; HTLC amount moves to recipient balance in new state.
 *
 * Spec: `fulfillHTLC(channel, htlcId, preimage, leaseProvider)` — signer optional.
 */
export async function fulfillHTLC(
  channel: OmniaChannel,
  htlcId: string,
  preimage: string,
  leaseProvider: WotsLeaseProvider,
  signer?: ChannelSigner,
): Promise<{ channel: OmniaChannel; partialState: Partial<SignedChannelState>; error?: string }> {
  if (channel.status !== 'active') {
    throw new ChannelStatusError('active', channel.status);
  }

  const effectiveSigner = signer ?? channel.localSigner;
  if (!effectiveSigner) throw new Error('No signer provided and channel.localSigner is not set');

  const htlc = channel.pendingHTLCs.find(h => h.htlcId === htlcId && h.status === 'pending');
  if (!htlc) throw new Error(`HTLC ${htlcId} not found or not pending`);

  const valid = HTLCHelper.verifyPreimage(preimage, htlc.hashlock, 'sha3');
  if (!valid) throw new Error(`Preimage does not match hashlock for HTLC ${htlcId}`);

  const recipientPartyId = channel.parties.find(
    p => p.publicKeyDigest === htlc.recipientPublicKeyDigest
  )?.partyId;
  if (!recipientPartyId) throw new Error('Recipient party not found in channel');

  const signerPartyId = channel.parties.find(
    p => p.publicKeyDigest === effectiveSigner.publicKeyDigest
  )?.partyId;
  if (!signerPartyId) throw new Error('Signer is not a channel participant');

  const newHTLCs = channel.pendingHTLCs.map(h =>
    h.htlcId === htlcId ? { ...h, status: 'fulfilled' as const } : h
  );

  const newBalances: Record<string, bigint> = { ...channel.balances };
  newBalances[recipientPartyId] = (newBalances[recipientPartyId] ?? 0n) + htlc.amount;

  const newSequence = channel.currentSequence + 1;

  const htlcTotal = newHTLCs.filter(h => h.status === 'pending').reduce((a, h) => a + h.amount, 0n);
  const balanceSum = Object.values(newBalances).reduce((a, b) => a + b, 0n);
  if (balanceSum + htlcTotal !== channel.totalValue) {
    throw new BalanceConservationError(channel.totalValue, balanceSum + htlcTotal);
  }
  for (const [partyId, balance] of Object.entries(newBalances)) {
    if (balance < 0n) {
      throw new Error(`Negative balance for ${partyId}: ${balance}`);
    }
  }

  // ── Shared update guards (capacity, watermark double-sign/stale-sequence) ──
  const commitment = computeStateCommitment(newSequence, newBalances, newHTLCs);
  const payloadHash = bytesToHex(commitment);
  const guardError = enforceUpdateGuards(channel.channelId, newSequence, payloadHash, channel.pendingProposal);
  if (guardError) {
    return { channel, partialState: {}, error: guardError };
  }

  const channelWithSettled: OmniaChannel = {
    ...channel,
    pendingHTLCs: newHTLCs,
    pendingProposal: { sequence: newSequence, payloadHash },
  };

  const partialState = await signState(
    channelWithSettled,
    { newSequence, newBalances },
    leaseProvider,
    effectiveSigner,
  );

  // Signing-index monotonicity: new flat index must exceed the previous one.
  const signerIndices = partialState.signingIndices![signerPartyId];
  if (channel.latestState) {
    const prevIndices = channel.latestState.signingIndices[signerPartyId];
    if (prevIndices) {
      const prevFlat = flatSigningIndex(prevIndices.l1, prevIndices.l2);
      const newFlat = flatSigningIndex(signerIndices.l1, signerIndices.l2);
      if (newFlat <= prevFlat) {
        throw new SigningIndexMonotonicityError(signerPartyId, prevFlat, newFlat);
      }
    }
  }

  const updatedChannel: OmniaChannel = {
    ...channel,
    balances: newBalances,
    pendingHTLCs: newHTLCs,
    currentSequence: newSequence,
    updatedAt: Date.now(),
    stateLog: [
      ...channel.stateLog,
      {
        sequence: newSequence,
        timestamp: Date.now(),
        balances: { ...newBalances },
        htlcCount: newHTLCs.filter(h => h.status === 'pending').length,
        event: 'htlc_fulfill',
      },
    ],
  };

  return { channel: updatedChannel, partialState };
}

/**
 * After `timeoutBlock`, HTLC amount returns to sender balance in new state.
 *
 * Spec: `timeoutHTLC(channel, htlcId, leaseProvider, chainProvider)` — signer is optional.
 * The current block height is fetched from `chainProvider.getTip()` — the caller
 * cannot supply an untrusted height. This prevents premature timeout attacks.
 */
export async function timeoutHTLC(
  channel: OmniaChannel,
  htlcId: string,
  leaseProvider: WotsLeaseProvider,
  chainProvider: ChainStateProvider,
  signer?: ChannelSigner,
): Promise<{ channel: OmniaChannel; partialState: Partial<SignedChannelState>; error?: string }> {
  if (channel.status !== 'active') {
    throw new ChannelStatusError('active', channel.status);
  }

  const effectiveSigner = signer ?? channel.localSigner;
  if (!effectiveSigner) throw new Error('No signer provided and channel.localSigner is not set');

  const htlc = channel.pendingHTLCs.find(h => h.htlcId === htlcId && h.status === 'pending');
  if (!htlc) throw new Error(`HTLC ${htlcId} not found or not pending`);

  const tip = await chainProvider.getTip();
  const currentBlock = BigInt(tip.block);
  if (currentBlock < htlc.timeoutBlock) {
    throw new Error(`HTLC ${htlcId} has not yet timed out (block ${currentBlock} < ${htlc.timeoutBlock})`);
  }

  const senderPartyId = channel.parties.find(
    p => p.publicKeyDigest === htlc.senderPublicKeyDigest
  )?.partyId;
  if (!senderPartyId) throw new Error('Sender party not found in channel');

  const signerPartyId = channel.parties.find(
    p => p.publicKeyDigest === effectiveSigner.publicKeyDigest
  )?.partyId;
  if (!signerPartyId) throw new Error('Signer is not a channel participant');

  const newHTLCs = channel.pendingHTLCs.map(h =>
    h.htlcId === htlcId ? { ...h, status: 'timed_out' as const } : h
  );

  const newBalances: Record<string, bigint> = { ...channel.balances };
  newBalances[senderPartyId] = (newBalances[senderPartyId] ?? 0n) + htlc.amount;

  const newSequence = channel.currentSequence + 1;

  const htlcTotal = newHTLCs.filter(h => h.status === 'pending').reduce((a, h) => a + h.amount, 0n);
  const balanceSum = Object.values(newBalances).reduce((a, b) => a + b, 0n);
  if (balanceSum + htlcTotal !== channel.totalValue) {
    throw new BalanceConservationError(channel.totalValue, balanceSum + htlcTotal);
  }
  for (const [partyId, balance] of Object.entries(newBalances)) {
    if (balance < 0n) {
      throw new Error(`Negative balance for ${partyId}: ${balance}`);
    }
  }

  // ── Shared update guards (capacity, watermark double-sign/stale-sequence) ──
  const commitment = computeStateCommitment(newSequence, newBalances, newHTLCs);
  const payloadHash = bytesToHex(commitment);
  const guardError = enforceUpdateGuards(channel.channelId, newSequence, payloadHash, channel.pendingProposal);
  if (guardError) {
    return { channel, partialState: {}, error: guardError };
  }

  const channelWithTimeout: OmniaChannel = {
    ...channel,
    pendingHTLCs: newHTLCs,
    pendingProposal: { sequence: newSequence, payloadHash },
  };

  const partialState = await signState(
    channelWithTimeout,
    { newSequence, newBalances },
    leaseProvider,
    effectiveSigner,
  );

  // Signing-index monotonicity: new flat index must exceed the previous one.
  const signerIndices = partialState.signingIndices![signerPartyId];
  if (channel.latestState) {
    const prevIndices = channel.latestState.signingIndices[signerPartyId];
    if (prevIndices) {
      const prevFlat = flatSigningIndex(prevIndices.l1, prevIndices.l2);
      const newFlat = flatSigningIndex(signerIndices.l1, signerIndices.l2);
      if (newFlat <= prevFlat) {
        throw new SigningIndexMonotonicityError(signerPartyId, prevFlat, newFlat);
      }
    }
  }

  const updatedChannel: OmniaChannel = {
    ...channel,
    balances: newBalances,
    pendingHTLCs: newHTLCs,
    currentSequence: newSequence,
    updatedAt: Date.now(),
    stateLog: [
      ...channel.stateLog,
      {
        sequence: newSequence,
        timestamp: Date.now(),
        balances: { ...newBalances },
        htlcCount: newHTLCs.filter(h => h.status === 'pending').length,
        event: 'htlc_timeout',
      },
    ],
  };

  return { channel: updatedChannel, partialState };
}
