import { HTLCHelper, bytesToHex, sha3_256 } from '@totemsdk/core';
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
import { signState, verifyStateSignature } from './sign.js';
import { enforceUpdateGuards, releaseUpdateGuard } from './channel.js';
import { flatSigningIndex } from './capacity.js';
import { computeProgramUpdateDigestHex } from './program.js';
import { STATE_COMMITMENT_V2_PORT } from './transactions.js';


async function signStateGuarded(
  channel: OmniaChannel,
  update: { newSequence: number; newBalances: Record<string, bigint> },
  leaseProvider: WotsLeaseProvider,
  signer: ChannelSigner | undefined,
  payloadHash: string,
): Promise<Partial<SignedChannelState>> {
  try {
    return await signState(channel, update, leaseProvider, signer);
  } catch (err) {
    releaseUpdateGuard(channel.channelId, update.newSequence, payloadHash);
    throw err;
  }
}

export const HTLC_FEE_PROOF_DOMAIN = 'totemsdk/omnia/htlc-fulfillment/v1';

/**
 * Canonical HTLC transition boundary (OMN-093).
 *
 * The deployed program validates a refund when `currentBlock >= timeoutBlock`
 * (`program.ts`, `validateTransition` → `'htlc timeout block not reached'`).
 * At the exact timeout block, therefore, only the **refund** path is valid and
 * a fulfil must already be refused. This predicate is the single place that
 * decision is made.
 */
export function htlcTransitionEligibility(
  htlc: Pick<HTLCRecord, 'timeoutBlock'>,
  currentBlock: bigint,
): 'claim' | 'refund' {
  return currentBlock >= htlc.timeoutBlock ? 'refund' : 'claim';
}

/**
 * A verifiable fee-provenance record for a fulfilled HTLC (#27): the exact
 * artifact a pool's `recordPoolFee` earn-proof consumes. It binds the channel,
 * the HTLC, the recipient, and the amount so a fee record can be traced to a
 * real fulfilled payment — never a declared string.
 */
export interface HtlcFulfillmentReceipt {
  channelId: string;
  htlcId: string;
  recipientPublicKeyDigest: string;
  amount: bigint;
  tokenId: string;
  fulfilledAt: number;
  /** Sequence of the authenticated successor state. */
  sequence: number;
  /** Sequence of the authenticated predecessor state (OMN-094). */
  previousSequence: number;
  /** Port-102 commitment of the signed state that fulfils the HTLC. */
  stateCommitmentV2: string;
  /** Port-102 commitment of the state the HTLC was pending in (OMN-094). */
  previousStateCommitmentV2: string;
  /** Exact amount the transition moved to the recipient (OMN-094). */
  balanceDelta: bigint;
  receiptHash: string;
}

/** The authenticated transition a receipt describes. */
export interface HtlcFulfillmentTransition {
  /** State the HTLC was still pending in. */
  previous: SignedChannelState;
  /** State that fulfils it. */
  next: SignedChannelState;
}

function commitmentOf(state: SignedChannelState, label: string): string {
  const commitment = state.stateVariables.find(v => v.port === STATE_COMMITMENT_V2_PORT);
  if (!commitment) throw new Error(`${label} is missing the port-102 commitment`);
  return String(commitment.value).replace(/^0x/i, '').toLowerCase();
}

/**
 * Build a fee-provenance receipt bound to an **authenticated transition**.
 *
 * OMN-094: the receipt no longer reads the amount from the channel's historical
 * record. It derives it from the balance delta between the predecessor and
 * successor states, carries both commitments, and refuses to build when the
 * states do not describe the fulfilment being claimed.
 */
export function buildHtlcFulfillmentReceipt(
  channel: OmniaChannel,
  transition: HtlcFulfillmentTransition,
  htlcId: string,
  fulfilledAt?: number,
): HtlcFulfillmentReceipt {
  const { previous, next } = transition;
  if (next.sequence <= previous.sequence) {
    throw new Error('Signed successor state does not follow the predecessor');
  }

  const pending = previous.pendingHTLCs.find(h => h.htlcId === htlcId);
  if (!pending) {
    throw new Error(`HTLC ${htlcId} is not pending in the predecessor state`);
  }
  if (next.pendingHTLCs.some(h => h.htlcId === htlcId)) {
    throw new Error(`Signed state still carries HTLC ${htlcId} as pending`);
  }

  const recipient = channel.parties.find(p => p.publicKeyDigest === pending.recipientPublicKeyDigest);
  if (!recipient) throw new Error('HTLC recipient is not a channel party');

  const balanceDelta = (next.balances[recipient.partyId] ?? 0n) - (previous.balances[recipient.partyId] ?? 0n);
  if (balanceDelta !== pending.amount) {
    throw new Error(
      `Signed states move ${balanceDelta.toString()} to the recipient, not the HTLC amount ${pending.amount.toString()}`,
    );
  }

  const receipt: HtlcFulfillmentReceipt = {
    channelId: channel.channelId,
    htlcId,
    recipientPublicKeyDigest: pending.recipientPublicKeyDigest,
    amount: pending.amount,
    tokenId: channel.tokenId,
    fulfilledAt: fulfilledAt ?? Date.now(),
    sequence: next.sequence,
    previousSequence: previous.sequence,
    stateCommitmentV2: commitmentOf(next, 'Signed state'),
    previousStateCommitmentV2: commitmentOf(previous, 'Predecessor state'),
    balanceDelta,
    receiptHash: '',
  };
  receipt.receiptHash = computeHtlcFulfillmentReceiptHash(receipt);
  return receipt;
}

export function computeHtlcFulfillmentReceiptHash(receipt: HtlcFulfillmentReceipt): string {
  const { receiptHash: _receiptHash, ...rest } = receipt;
  const input = `${HTLC_FEE_PROOF_DOMAIN}|${JSON.stringify(rest, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value)}`;
  return bytesToHex(sha3_256(new TextEncoder().encode(input)));
}

/**
 * Verify a receipt against the authenticated states it claims to describe.
 *
 * Requires: the receipt to rebuild exactly from the two states, the recipient's
 * signature on the successor, and every signature present on the predecessor to
 * be valid for its party.
 */
export function verifyHtlcFulfillmentReceipt(
  channel: OmniaChannel,
  transition: HtlcFulfillmentTransition,
  receipt: HtlcFulfillmentReceipt,
): boolean {
  try {
    if (receipt.channelId !== channel.channelId) return false;
    if (receipt.sequence !== transition.next.sequence) return false;
    if (receipt.previousSequence !== transition.previous.sequence) return false;

    const rebuilt = buildHtlcFulfillmentReceipt(channel, transition, receipt.htlcId, receipt.fulfilledAt);
    if (rebuilt.receiptHash !== receipt.receiptHash) return false;
    if (rebuilt.receiptHash !== computeHtlcFulfillmentReceiptHash(receipt)) return false;
    if (rebuilt.amount !== receipt.amount) return false;
    if (rebuilt.balanceDelta !== receipt.balanceDelta) return false;
    if (rebuilt.recipientPublicKeyDigest !== receipt.recipientPublicKeyDigest) return false;
    if (rebuilt.tokenId !== receipt.tokenId) return false;
    if (rebuilt.stateCommitmentV2 !== receipt.stateCommitmentV2) return false;
    if (rebuilt.previousStateCommitmentV2 !== receipt.previousStateCommitmentV2) return false;

    const recipient = channel.parties.find(p => p.publicKeyDigest === receipt.recipientPublicKeyDigest);
    if (!recipient || !transition.next.signatures[recipient.partyId]) return false;
    if (!verifyStateSignature(channel, transition.next, recipient.partyId, recipient.publicKeyDigest)) {
      return false;
    }

    for (const partyId of Object.keys(transition.previous.signatures)) {
      const party = channel.parties.find(p => p.partyId === partyId);
      if (!party) return false;
      if (!verifyStateSignature(channel, transition.previous, partyId, party.publicKeyDigest)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

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

  if (params.direction !== 'offered' && params.direction !== 'received') {
    throw new Error(`HTLC direction must be 'offered' or 'received', got ${String(params.direction)}`);
  }
  const normalizeHexLiteral = (value: string): string => {
    if (typeof value !== 'string' || !/^(0x)?[0-9a-fA-F]{64}$/.test(value)) {
      throw new Error(`HTLC hashlock must be a 32-byte hex string, got ${JSON.stringify(value)}`);
    }
    return '0x' + value.replace(/^0x/i, '').toLowerCase();
  };
  const hashlock = normalizeHexLiteral(params.hashlock);
  if (typeof params.timeoutBlock !== 'bigint' || params.timeoutBlock <= 0n) {
    throw new Error(`HTLC timeoutBlock must be a positive bigint, got ${String(params.timeoutBlock)}`);
  }

  // The HTLC must pay the channel counterparty. An arbitrary recipient key would
  // create an HTLC the counterparty never agreed to and can never claim.
  const counterParty = channel.parties.find(p => p.publicKeyDigest !== effectiveSigner.publicKeyDigest);
  if (!counterParty) throw new Error('Counter party not found');
  if (
    typeof params.counterpartPublicKeyDigest !== 'string' ||
    params.counterpartPublicKeyDigest.toLowerCase() !== counterParty.publicKeyDigest.toLowerCase()
  ) {
    throw new Error(
      `HTLC counterparty ${JSON.stringify(params.counterpartPublicKeyDigest)} is not the channel counterparty`,
    );
  }
  if (params.amount <= 0n) {
    throw new Error(`HTLC amount must be positive: ${params.amount}`);
  }
  const scale = channel.tokenScale ?? 0;
  if (scale > 0 && params.amount % (10n ** BigInt(scale)) !== 0n) {
    throw new Error(`HTLC amount ${params.amount} is not a whole number of raw units at tokenScale ${scale}`);
  }
  const offererBalance = channel.balances[offererPartyId] ?? 0n;
  if (params.amount > offererBalance) {
    throw new Error(`Insufficient balance: ${offererBalance} < ${params.amount}`);
  }

  const { script: _htlcScript, address: htlcAddress } = HTLCHelper.createHTLC(
    effectiveSigner.publicKeyDigest,
    params.counterpartPublicKeyDigest,
    hashlock,
    params.timeoutBlock,
  );

  const htlcRecord: HTLCRecord = {
    htlcId: generateHtlcId(),
    amount: params.amount,
    hashlock,
    timeoutBlock: params.timeoutBlock,
    direction: params.direction,
    status: 'pending',
    htlcAddress,
    senderPublicKeyDigest: effectiveSigner.publicKeyDigest,
    recipientPublicKeyDigest: counterParty.publicKeyDigest,
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
  const payloadHash = computeProgramUpdateDigestHex({ ...channel, pendingHTLCs: newHTLCs }, newSequence, newBalances, newHTLCs);
  const guardError = enforceUpdateGuards(channel.channelId, newSequence, payloadHash, channel.pendingProposal);
  if (guardError) {
    return { channel, htlcId: htlcRecord.htlcId, partialState: {}, error: guardError };
  }

  const channelWithHTLC: OmniaChannel = {
    ...channel,
    pendingHTLCs: newHTLCs,
    pendingProposal: { sequence: newSequence, payloadHash },
  };

  const partialState = await signStateGuarded(
    channelWithHTLC,
    { newSequence, newBalances },
    leaseProvider,
    effectiveSigner,
    payloadHash,
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

  if (typeof preimage !== 'string' || !/^(0x)?[0-9a-fA-F]{64}$/.test(preimage)) {
    throw new Error('HTLC preimage must be a 32-byte hex string');
  }
  const normalizedPreimage = '0x' + preimage.replace(/^0x/i, '').toLowerCase();

  // OMN-093: the refund path owns the exact timeout block, so a fulfil is
  // refused from `timeoutBlock` onwards. This matches the deployed program.
  const tip = await chainProvider.getTip();
  if (htlcTransitionEligibility(htlc, BigInt(tip.block)) === 'refund') {
    throw new Error(
      `HTLC ${htlcId} expired at block ${htlc.timeoutBlock} (current ${tip.block}); fulfil is no longer valid`,
    );
  }

  const valid = HTLCHelper.verifyPreimage(normalizedPreimage, htlc.hashlock, 'sha3');
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
  const payloadHash = computeProgramUpdateDigestHex({ ...channel, pendingHTLCs: newHTLCs }, newSequence, newBalances, newHTLCs);
  const guardError = enforceUpdateGuards(channel.channelId, newSequence, payloadHash, channel.pendingProposal);
  if (guardError) {
    return { channel, partialState: {}, error: guardError };
  }

  const channelWithSettled: OmniaChannel = {
    ...channel,
    pendingHTLCs: newHTLCs,
    pendingProposal: { sequence: newSequence, payloadHash },
  };

  const partialState = await signStateGuarded(
    channelWithSettled,
    { newSequence, newBalances },
    leaseProvider,
    effectiveSigner,
    payloadHash,
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
  if (htlcTransitionEligibility(htlc, currentBlock) === 'claim') {
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
  const payloadHash = computeProgramUpdateDigestHex({ ...channel, pendingHTLCs: newHTLCs }, newSequence, newBalances, newHTLCs);
  const guardError = enforceUpdateGuards(channel.channelId, newSequence, payloadHash, channel.pendingProposal);
  if (guardError) {
    return { channel, partialState: {}, error: guardError };
  }

  const channelWithTimeout: OmniaChannel = {
    ...channel,
    pendingHTLCs: newHTLCs,
    pendingProposal: { sequence: newSequence, payloadHash },
  };

  const partialState = await signStateGuarded(
    channelWithTimeout,
    { newSequence, newBalances },
    leaseProvider,
    effectiveSigner,
    payloadHash,
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
