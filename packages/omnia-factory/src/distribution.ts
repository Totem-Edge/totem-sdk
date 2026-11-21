/**
 * OMN-058 / RFC-079 §4A — output-enforced full distribution.
 *
 * The covenant built by `buildFactoryDistributionScript` (and the
 * `settlement: 'full-distribution'` funding branch) pays every committed share
 * of the *spent* coin. This module materializes the matching transaction from
 * the factory's authoritative allocation, so the SDK cannot build a payout set
 * the covenant would reject.
 *
 * Scope: the latest **confirmed** allocation (funding coin or checkpoint). A
 * newer off-chain state is not covered until the contestable protocol lands.
 */

import type { OmniaTxDraft, TxOutputDraft } from '@totemsdk/omnia';
import { wotsAddressData } from '@totemsdk/core';

import type { ChannelFactory, FactoryParticipant } from './types.js';

export interface FactoryDistributionEntry extends TxOutputDraft {
  partyId: string;
}

export interface FactoryDistribution {
  draft: OmniaTxDraft;
  outputs: FactoryDistributionEntry[];
  /** Total value distributed (atoms). */
  total: bigint;
}

/**
 * Refuse to distribute while the factory still backs open virtual channels: the
 * distribution covenant pays only the participant shares, so a VC reserve would
 * be stranded or, worse, paid to the wrong party.
 */
export function assertFactoryDistributable(factory: ChannelFactory): void {
  const open = (factory.virtualChannels ?? []).filter(
    (channel) => channel.status !== 'closed' && channel.totalValue > 0n,
  );
  if (open.length > 0) {
    const ids = open.map((channel) => channel.channelId).join(', ');
    throw new Error(
      `factory ${factory.factoryId} cannot be distributed while ${open.length} virtual channel(s) hold value (${ids}); `
      + 'settle them to separately enforceable outputs first',
    );
  }
}

/**
 * The exact payout set for the current committed allocation, in participant
 * order. Addresses default to the participant settlement address.
 */
export function factoryDistributionPayouts(factory: ChannelFactory): Array<{
  partyId: string;
  address: string;
  amount: bigint;
}> {
  const participants = factory.participants ?? [];
  if (participants.length === 0) {
    throw new Error(`factory ${factory.factoryId} has no participants`);
  }
  let sum = 0n;
  const payouts = participants.map((participant: FactoryParticipant, index) => {
    const amount = factory.allocations?.[participant.partyId] ?? 0n;
    if (amount < 0n) {
      throw new Error(`allocation for ${participant.partyId} must be non-negative`);
    }
    // The covenant is built once, at funding, and pins one output per
    // participant (`@TOTOUT EQ N`) with `VERIFYOUT(k … PREVSTATE(port))`. A
    // zero committed share would require a zero-value output, which Minima
    // rejects (`0 < amount`), so the branch cannot settle. Fail closed with the
    // actionable alternative instead of building an invalid transaction.
    if (amount === 0n) {
      throw new Error(
        `factory ${factory.factoryId} cannot distribute: participant ${participant.partyId} has a zero committed share `
        + 'and the distribution covenant requires a non-zero output for every participant. '
        + 'Rebalance with a checkpoint, or use the per-party escape for the other shares.',
      );
    }
    sum += amount;
    const raw = (participant.settlementAddress ?? participant.publicKeyDigest ?? '').replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
      throw new Error(`participant[${index}] payout address must be a 64-hex digest`);
    }
    return { partyId: participant.partyId, address: wotsAddressData(raw), amount };
  });

  const vcReserve = (factory.virtualChannels ?? [])
    .filter((channel) => channel.status !== 'closed')
    .reduce((total, channel) => total + channel.totalValue, 0n);
  if (sum + vcReserve !== factory.totalValue) {
    throw new Error(
      `factory allocations (${sum}) plus virtual-channel reserves (${vcReserve}) do not equal the factory total (${factory.totalValue})`,
    );
  }
  return payouts;
}

/**
 * Build the distribution transaction for the factory coin. The output order
 * matches the participant order used by the covenant, and every amount comes
 * from the committed allocation.
 */
export function buildFactoryDistribution(
  factory: ChannelFactory,
  params: { fundingCoinId: string; fundingAddress?: string },
): FactoryDistribution {
  assertFactoryDistributable(factory);
  if (!params.fundingCoinId) {
    throw new Error('buildFactoryDistribution requires the factory funding coin id');
  }
  const address = params.fundingAddress ?? factory.fundingAddress;
  if (!address) {
    throw new Error('buildFactoryDistribution requires the factory funding address');
  }

  const payouts = factoryDistributionPayouts(factory);
  const total = payouts.reduce((sum, payout) => sum + payout.amount, 0n);

  const outputs: FactoryDistributionEntry[] = payouts.map((payout) => ({
    partyId: payout.partyId,
    address: payout.address,
    amount: payout.amount,
    tokenId: factory.tokenId,
    storeState: false,
    stateVariables: [],
  }));

  const draft: OmniaTxDraft = {
    type: 'settlement',
    inputs: [{
      coinId: params.fundingCoinId,
      address,
      amount: factory.totalValue,
      tokenId: factory.tokenId,
      scriptHex: '',
      storeState: true,
    }],
    outputs,
    storeState: false,
    stateVariables: [],
  };

  return { draft, outputs, total };
}
