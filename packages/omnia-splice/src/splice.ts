import type { OmniaChannel } from '@totemsdk/omnia';
import type {
  SpliceParams,
  SpliceProposal,
  SpliceAcceptance,
  SpliceLeaseProvider,
  QuiescedChannel,
} from './types.js';
import { buildSpliceTx, computeSpliceTxDigest, spliceDraftToMinimaBytes } from './splice-tx.js';
import {
  PendingHTLCError,
  SpliceChannelStatusError,
  SpliceMissingPartyError,
} from './errors.js';

/**
 * Scale existing balances proportionally to a new total, preserving relative
 * ratios. The last party absorbs rounding so that sum(result) === newTotal
 * exactly. Used as the default newBalances when a caller omits the argument.
 */
function scaleBalances(
  balances: Record<string, bigint>,
  oldTotal: bigint,
  newTotal: bigint,
): Record<string, bigint> {
  if (oldTotal === 0n) {
    const partyIds = Object.keys(balances);
    const each = partyIds.length > 0 ? newTotal / BigInt(partyIds.length) : 0n;
    const result: Record<string, bigint> = {};
    let assigned = 0n;
    for (let i = 0; i < partyIds.length - 1; i++) {
      result[partyIds[i]] = each;
      assigned += each;
    }
    const last = partyIds[partyIds.length - 1];
    if (last !== undefined) result[last] = newTotal - assigned;
    return result;
  }
  const partyIds = Object.keys(balances);
  const scaled: Record<string, bigint> = {};
  let assigned = 0n;
  for (let i = 0; i < partyIds.length - 1; i++) {
    const pid = partyIds[i];
    const prev = balances[pid] ?? 0n;
    scaled[pid] = (prev * newTotal) / oldTotal;
    assigned += scaled[pid];
  }
  const last = partyIds[partyIds.length - 1];
  if (last !== undefined) scaled[last] = newTotal - assigned;
  return scaled;
}

function generateSpliceId(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return '0x' + buf.reduce((hex, b) => hex + b.toString(16).padStart(2, '0'), '');
}

/**
 * Gate: all splice operations (propose, accept, finalize) require the channel
 * to be in 'quiesced' state. Quiescing ensures all in-flight HTLCs are settled
 * and the pre-splice balance split is mutually signed before any splice TX is built.
 */
function validateChannelQuiesced(channel: OmniaChannel | QuiescedChannel): void {
  if (channel.status !== 'quiesced') {
    throw new SpliceChannelStatusError('quiesced', channel.status);
  }
  const pending = channel.pendingHTLCs.filter(h => h.status === 'pending').length;
  if (pending > 0) {
    throw new PendingHTLCError(pending);
  }
}

/**
 * Validate proposal balance conservation and amount constraints.
 * Called by acceptSplice before signing to independently verify inbound params.
 */
function validateProposalParams(
  channel: OmniaChannel | QuiescedChannel,
  params: SpliceParams,
): void {
  const balanceSum = Object.values(params.newBalances).reduce((a, b) => a + b, 0n);
  if (balanceSum !== params.newTotalValue) {
    throw new Error(
      `Proposal integrity check failed: newBalances sum (${balanceSum}) !== newTotalValue (${params.newTotalValue})`,
    );
  }

  if (params.type === 'splice_out' && (params.withdrawAmount ?? 0n) > channel.totalValue) {
    throw new Error(
      `Proposal integrity check failed: withdrawAmount (${params.withdrawAmount}) exceeds channel totalValue (${channel.totalValue})`,
    );
  }

  const channelOutput = params.newTotalValue;
  const withdrawSum = params.withdrawAmount ?? 0n;
  const extraSum = (params.extraOutputs ?? []).reduce((a, o) => a + o.amount, 0n);

  if (params.type === 'splice_in') {
    const expectedExistingInput = channelOutput + withdrawSum + extraSum - (params.additionalAmount ?? 0n);
    if (expectedExistingInput !== channel.totalValue) {
      throw new Error(
        `Proposal integrity check failed: splice-in amounts inconsistent ` +
        `(expected existing channel input ${channel.totalValue}, derived ${expectedExistingInput})`,
      );
    }
  } else {
    if (channelOutput + withdrawSum + extraSum !== channel.totalValue) {
      throw new Error(
        `Proposal integrity check failed: splice-out amounts do not sum to channel total ` +
        `(${channelOutput} + ${withdrawSum} + ${extraSum} !== ${channel.totalValue})`,
      );
    }
  }
}

/**
 * Verify that `spliceTxDraft` is exactly what the params would produce by
 * rebuilding the draft deterministically and comparing digests.
 *
 * Prevents a tampered proposal where params.newBalances is modified but
 * spliceTxDraft is left unchanged (or vice versa), causing channel state
 * to diverge from the actual on-chain TX outputs.
 */
function bindDraftToParams(
  channel: OmniaChannel | QuiescedChannel,
  proposal: SpliceProposal,
): void {
  const recomputed = buildSpliceTx(channel as OmniaChannel, proposal.params);
  const expected = computeSpliceTxDigest(recomputed);
  const actual = computeSpliceTxDigest(proposal.spliceTxDraft);
  if (!expected.every((b, i) => b === actual[i])) {
    throw new Error(
      'Proposal spliceTxDraft is inconsistent with proposal.params — ' +
      'the TX draft may have been tampered with',
    );
  }
}

/**
 * Initiating party proposes a splice-in: add external funds to the channel.
 *
 * Requires the channel to be in 'quiesced' state (see quiesceChannel).
 *
 * WOTS lease safety: a key slot is reserved via `leaseProvider.wotsLease`
 * before signing. The returned `proposerReservationId` and
 * `proposerSigningIndices` must be passed through to `finalizeSplice`
 * (embedded in the `SpliceProposal`) so the reservation is committed on
 * success or burned on failure, preventing one-time-key reuse.
 *
 * @param channel           - Quiesced channel to splice.
 * @param additionalCoinId  - CoinId of the external coin being spliced in.
 * @param additionalAmount  - Amount of the additional coin.
 * @param leaseProvider     - Provides the proposer signer and WOTS lease.
 * @param newBalances       - How the new total should be split after splice.
 *                            When omitted, existing balances are scaled
 *                            proportionally to the new total value so that
 *                            `sum(newBalances) === newTotalValue` is preserved.
 * @returns SpliceProposal signed by the proposer with lease reservation data.
 */
export async function proposeSpliceIn(
  channel: OmniaChannel | QuiescedChannel,
  additionalCoinId: string,
  additionalAmount: bigint,
  leaseProvider: SpliceLeaseProvider,
  newBalances?: Record<string, bigint>,
): Promise<SpliceProposal> {
  validateChannelQuiesced(channel);

  const newTotal = channel.totalValue + additionalAmount;

  const effectiveNewBalances = newBalances ?? scaleBalances(channel.balances, channel.totalValue, newTotal);

  const params: SpliceParams = {
    type: 'splice_in',
    newTotalValue: newTotal,
    newBalances: effectiveNewBalances,
    additionalCoinId,
    additionalAmount,
  };

  const draft = buildSpliceTx(channel as OmniaChannel, params);
  const digest = computeSpliceTxDigest(draft);
  const spliceTxHex = Buffer.from(spliceDraftToMinimaBytes(draft)).toString('hex');

  const { signer, wotsLease } = leaseProvider;
  const partyInChannel = channel.parties.find(p => p.publicKeyDigest === signer.publicKeyDigest);
  if (!partyInChannel) {
    throw new SpliceMissingPartyError(signer.publicKeyDigest);
  }

  const reservation = await wotsLease.reserveKeyUse({
    treeId: signer.publicKeyDigest,
    purpose: 'omnia-splice-propose',
    payloadHash: Buffer.from(digest).toString('hex'),
  });

  const signature = await signer.sign(digest, reservation.indices);

  return {
    spliceId: generateSpliceId(),
    channelId: channel.channelId,
    params,
    spliceTxHex,
    spliceTxDraft: draft,
    proposerPublicKeyDigest: signer.publicKeyDigest,
    proposerSignature: signature,
    proposerReservationId: reservation.reservationId,
    proposerSigningIndices: reservation.indices,
    proposedAt: Date.now(),
  };
}

/**
 * Initiating party proposes a splice-out: withdraw funds from the channel on-chain.
 *
 * Requires the channel to be in 'quiesced' state (see quiesceChannel).
 *
 * WOTS lease safety: reserves a key slot before signing (same semantics as
 * proposeSpliceIn). The `proposerReservationId` in the returned `SpliceProposal`
 * must be committed/burned by `finalizeSplice`.
 *
 * @param channel         - Quiesced channel.
 * @param withdrawAmount  - Amount to remove from the channel.
 * @param withdrawAddress - On-chain destination for the withdrawn funds.
 * @param leaseProvider   - Provides the proposer signer and WOTS lease.
 * @param newBalances     - How the remaining total should be split after splice.
 * @param extraOutputs    - Optional additional on-chain outputs (third-party payments).
 * @returns SpliceProposal signed by the proposer with lease reservation data.
 */
export async function proposeSpliceOut(
  channel: OmniaChannel | QuiescedChannel,
  withdrawAmount: bigint,
  withdrawAddress: string,
  leaseProvider: SpliceLeaseProvider,
  newBalances?: Record<string, bigint>,
  extraOutputs?: Array<{ address: string; amount: bigint; tokenId?: string }>,
): Promise<SpliceProposal> {
  validateChannelQuiesced(channel);

  const extraSum = (extraOutputs ?? []).reduce((a, o) => a + o.amount, 0n);
  const totalOutflow = withdrawAmount + extraSum;
  if (totalOutflow > channel.totalValue) {
    throw new Error(
      `proposeSpliceOut: total outflow (withdraw ${withdrawAmount} + extra outputs ${extraSum} = ${totalOutflow}) ` +
      `exceeds channel totalValue (${channel.totalValue})`,
    );
  }
  const remainingTotal = channel.totalValue - totalOutflow;

  const effectiveNewBalances = newBalances ?? (() => {
    const ratio = channel.totalValue > 0n ? remainingTotal * 1000n / channel.totalValue : 0n;
    const adjusted: Record<string, bigint> = {};
    let assigned = 0n;
    const partyIds = Object.keys(channel.balances);
    for (let i = 0; i < partyIds.length - 1; i++) {
      const pid = partyIds[i];
      const prev = channel.balances[pid] ?? 0n;
      const scaled = (prev * ratio) / 1000n;
      adjusted[pid] = scaled;
      assigned += scaled;
    }
    const lastId = partyIds[partyIds.length - 1];
    if (lastId) adjusted[lastId] = remainingTotal - assigned;
    return adjusted;
  })();

  const params: SpliceParams = {
    type: 'splice_out',
    newTotalValue: remainingTotal,
    newBalances: effectiveNewBalances,
    withdrawAmount,
    withdrawAddress,
    extraOutputs,
  };

  const draft = buildSpliceTx(channel as OmniaChannel, params);
  const digest = computeSpliceTxDigest(draft);
  const spliceTxHex = Buffer.from(spliceDraftToMinimaBytes(draft)).toString('hex');

  const { signer, wotsLease } = leaseProvider;
  const partyInChannel = channel.parties.find(p => p.publicKeyDigest === signer.publicKeyDigest);
  if (!partyInChannel) {
    throw new SpliceMissingPartyError(signer.publicKeyDigest);
  }

  const reservation = await wotsLease.reserveKeyUse({
    treeId: signer.publicKeyDigest,
    purpose: 'omnia-splice-propose',
    payloadHash: Buffer.from(digest).toString('hex'),
  });

  const signature = await signer.sign(digest, reservation.indices);

  return {
    spliceId: generateSpliceId(),
    channelId: channel.channelId,
    params,
    spliceTxHex,
    spliceTxDraft: draft,
    proposerPublicKeyDigest: signer.publicKeyDigest,
    proposerSignature: signature,
    proposerReservationId: reservation.reservationId,
    proposerSigningIndices: reservation.indices,
    proposedAt: Date.now(),
  };
}

/**
 * Counterparty accepts a splice proposal by co-signing the splice TX digest.
 *
 * Requires the channel to be in 'quiesced' state.
 *
 * WOTS lease safety: reserves a key slot before signing. The returned
 * `acceptorReservationId` and `acceptorSigningIndices` are embedded in the
 * `SpliceAcceptance` and consumed by `finalizeSplice` to commit or burn the
 * acceptor's key-slot reservation.
 *
 * The acceptor independently:
 *   1. Validates party membership (proposer and acceptor both in channel).
 *   2. Validates proposal balance conservation and amount constraints.
 *   3. Cryptographically binds the signed draft to the proposal params by
 *      recomputing the expected draft from `params + channel` and comparing
 *      digests — rejects if they differ (tamper detection).
 *   4. Reserves a WOTS key slot via `leaseProvider.wotsLease`.
 *   5. Signs the splice TX digest with reserved indices.
 *
 * @param channel       - Quiesced channel.
 * @param proposal      - Splice proposal from the initiating party.
 * @param leaseProvider - Provides the acceptor signer and WOTS lease.
 * @returns SpliceAcceptance containing acceptor co-signature and lease data.
 */
export async function acceptSplice(
  channel: OmniaChannel | QuiescedChannel,
  proposal: SpliceProposal,
  leaseProvider: SpliceLeaseProvider,
): Promise<SpliceAcceptance> {
  validateChannelQuiesced(channel);

  if (proposal.channelId !== channel.channelId) {
    throw new Error(
      `Proposal channelId '${proposal.channelId}' does not match channel '${channel.channelId}'`,
    );
  }

  const proposerInChannel = channel.parties.find(
    p => p.publicKeyDigest === proposal.proposerPublicKeyDigest,
  );
  if (!proposerInChannel) {
    throw new SpliceMissingPartyError(proposal.proposerPublicKeyDigest);
  }

  const { signer, wotsLease } = leaseProvider;
  const partyInChannel = channel.parties.find(p => p.publicKeyDigest === signer.publicKeyDigest);
  if (!partyInChannel) {
    throw new SpliceMissingPartyError(signer.publicKeyDigest);
  }

  if (signer.publicKeyDigest === proposal.proposerPublicKeyDigest) {
    throw new Error('Acceptor and proposer cannot be the same party');
  }

  validateProposalParams(channel, proposal.params);
  bindDraftToParams(channel, proposal);

  const digest = computeSpliceTxDigest(proposal.spliceTxDraft);

  const reservation = await wotsLease.reserveKeyUse({
    treeId: signer.publicKeyDigest,
    purpose: 'omnia-splice-accept',
    payloadHash: Buffer.from(digest).toString('hex'),
  });

  const signature = await signer.sign(digest, reservation.indices);

  return {
    spliceId: proposal.spliceId,
    channelId: channel.channelId,
    acceptorPublicKeyDigest: signer.publicKeyDigest,
    acceptorSignature: signature,
    acceptorReservationId: reservation.reservationId,
    acceptorSigningIndices: reservation.indices,
    acceptedAt: Date.now(),
  };
}
