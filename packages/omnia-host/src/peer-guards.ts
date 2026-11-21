/**
 * Guards for peer-supplied finalization and signing requests.
 *
 * The host learns about a channel or factory from a peer, then keeps signing
 * and mutating state on the strength of later peer messages. Two rules keep
 * that honest:
 *
 *   1. Never apply a "finalized" message that does not correspond to local
 *      state this host created or accepted (CAN-007).
 *   2. Never sign a digest that the host did not derive itself for an
 *      operation it is already part of (CAN-010).
 *
 * These live in their own module so the rules can be tested without standing
 * up a host, swarm or chain.
 *
 * See docs/findings/agent/CAN-007.md and CAN-010.md in the canary.
 */
import { computeFactoryStateCommitment } from '@totemsdk/omnia-factory';
import type { ChannelFactory } from '@totemsdk/omnia-factory';
import type { SpliceAcceptance } from '@totemsdk/omnia-splice';
import type { OmniaChannel } from '@totemsdk/omnia';

const normalizeHex = (value: string): string => value.replace(/^0x/i, '').toLowerCase();

/** A virtual-channel proposal this host co-signed, awaiting VC_FINALIZED. */
export interface PendingVcAcceptance {
  kind: 'vc-open' | 'vc-close';
  factoryId: string;
  /** Party id whose signature this host returned in VC_ACCEPT. */
  localPartyId: string;
  /** CAN-019: the state this host signed, so the finalized message is compared. */
  expected?: {
    totalValue?: bigint;
    balances?: Record<string, bigint>;
    finalAllocations?: Record<string, bigint>;
    factoryAllocations?: Record<string, bigint>;
  };
}

/** CAN-019: the outcome the locally signed splice proposal commits to. */
export interface SpliceExpectation {
  channelId: string;
  totalValue: bigint;
  balances: Record<string, bigint>;
}

function amountBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return null;
}

function sameAmountMap(
  actual: Record<string, unknown> | undefined,
  expected: Record<string, bigint> | undefined,
): boolean {
  if (!expected) return true;
  if (!actual) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (actualKeys.length !== expectedKeys.length) return false;
  return expectedKeys.every((key, index) => {
    if (actualKeys[index] !== key) return false;
    const value = amountBigInt(actual[key]);
    return value !== null && value === expected[key];
  });
}

export interface SpliceFinalizedPayload {
  spliceId?: unknown;
  txId?: unknown;
  channel?: unknown;
}

export interface VcFinalizedPayload {
  kind?: unknown;
  factory?: ChannelFactory;
  channel?: OmniaChannel;
  channelId?: unknown;
}

/**
 * Resolve the locally accepted factory whose funding digest a peer is asking
 * us to sign (FACTORY_FUNDING_REQUEST).
 *
 * The digest must equal `pendingCommitment` of exactly one factory we accepted,
 * and the request must come from one of that factory's participants. Anything
 * else is an unbound signing request and is refused before a WOTS leaf is
 * reserved. The sender paths use channelId `factory-funding` in one case and
 * the factoryId in the other, so the digest — not the channel id — is the
 * binding.
 */
export function resolveFactoryFundingTarget(
  factories: ReadonlyMap<string, ChannelFactory>,
  requestedDigest: string,
  peerPubkey: string | undefined,
): ChannelFactory {
  const digest = normalizeHex(requestedDigest);
  if (!digest) throw new Error('factory funding request carries an empty digest');
  if (!peerPubkey) throw new Error('factory funding request has no authenticated peer identity');
  const peer = normalizeHex(peerPubkey);

  const matches = [...factories.values()].filter(
    (factory) =>
      typeof factory.pendingCommitment === 'string'
      && normalizeHex(factory.pendingCommitment) === digest,
  );
  if (matches.length === 0) {
    throw new Error('factory funding request does not match any locally accepted factory');
  }
  if (matches.length > 1) {
    // Two factories with the same funding digest is either a bug or an attempt
    // to make us sign for a factory we did not choose. Refuse rather than pick.
    throw new Error('factory funding request is ambiguous: more than one accepted factory matches');
  }

  const factory = matches[0]!;
  const participant = factory.participants.find(
    (party) => normalizeHex(party.publicKeyDigest) === peer,
  );
  if (!participant) {
    throw new Error('factory funding request came from a party that is not a factory participant');
  }
  return factory;
}

/**
 * CAN-018: a factory proposal must carry the commitment this host derived
 * itself. `rebuiltCommitment` comes from rebuildFactoryCommitment (the funding
 * transaction rebuilt from the proposal terms and materials), never from the
 * message.
 */
export function assertFactoryCommitment(
  claimedCommitment: string | undefined,
  rebuiltCommitment: string | undefined,
): void {
  if (!claimedCommitment) throw new Error('factory proposal has no pending commitment');
  if (!rebuiltCommitment) {
    throw new Error('factory proposal commitment could not be rebuilt from its funding materials');
  }
  if (normalizeHex(claimedCommitment) !== normalizeHex(rebuiltCommitment)) {
    throw new Error('factory proposal commitment does not match the locally rebuilt funding transaction');
  }
}

/**
 * CAN-019: a FACTORY_CLOSE_FINALIZED is a settlement claim. Require the tx id
 * and the final allocation split to match the factory this host holds.
 */
export function assertFactoryCloseSettlement(
  factory: ChannelFactory,
  payload: { factoryId?: unknown; txId?: unknown; finalAllocations?: unknown; settlementTxHex?: unknown },
  expected?: { settlementTxHex?: string },
): void {
  if (payload.factoryId !== factory.factoryId) {
    throw new Error('FACTORY_CLOSE_FINALIZED factoryId does not match the local factory');
  }
  if (typeof payload.txId !== 'string' || payload.txId.length === 0) {
    throw new Error('FACTORY_CLOSE_FINALIZED carries no settlement txId');
  }
  if (!payload.finalAllocations || typeof payload.finalAllocations !== 'object' || Array.isArray(payload.finalAllocations)) {
    throw new Error('FACTORY_CLOSE_FINALIZED carries no final allocations');
  }
  if (!sameAmountMap(
    payload.finalAllocations as Record<string, unknown>,
    factory.allocations as unknown as Record<string, bigint>,
  )) {
    throw new Error('FACTORY_CLOSE_FINALIZED allocations do not match the local factory');
  }
  // If this host signed a settlement for that factory, the finalized message
  // must carry that exact transaction, not just a txid and a matching split.
  if (expected?.settlementTxHex) {
    if (typeof payload.settlementTxHex !== 'string' || payload.settlementTxHex.length === 0) {
      throw new Error('FACTORY_CLOSE_FINALIZED does not carry the settlement transaction this host signed');
    }
    if (normalizeHex(payload.settlementTxHex) !== normalizeHex(expected.settlementTxHex)) {
      throw new Error('FACTORY_CLOSE_FINALIZED settlement transaction does not match the locally signed one');
    }
  }
}

/**
 * Validate SPLICE_FINALIZED against the acceptance this host produced when it
 * answered the matching SPLICE_PROPOSAL.
 *
 * A finalized splice must name a splice we accepted, carry the channel we
 * accepted it for, and agree with the transaction id it claims, before any of
 * it is written to the channel store.
 */
export function assertSpliceFinalized(
  acceptances: ReadonlyMap<string, SpliceAcceptance>,
  payload: SpliceFinalizedPayload,
  expectations?: ReadonlyMap<string, SpliceExpectation>,
  localChannel?: OmniaChannel,
): { acceptance: SpliceAcceptance; channel: OmniaChannel } {
  if (typeof payload.spliceId !== 'string' || payload.spliceId.length === 0) {
    throw new Error('SPLICE_FINALIZED without a spliceId');
  }
  const acceptance = acceptances.get(payload.spliceId);
  if (!acceptance) {
    throw new Error(`SPLICE_FINALIZED for splice ${payload.spliceId} has no matching local acceptance`);
  }

  const channel = payload.channel as (OmniaChannel & {
    splicedFrom?: string;
    spliceFundingTxId?: string;
  }) | undefined;
  if (!channel || typeof channel.channelId !== 'string' || channel.channelId.length === 0) {
    throw new Error('SPLICE_FINALIZED without a channel');
  }
  if (channel.channelId !== acceptance.channelId) {
    throw new Error('SPLICE_FINALIZED channel does not match the channel that was accepted');
  }
  if (typeof channel.splicedFrom === 'string' && channel.splicedFrom !== acceptance.channelId) {
    throw new Error('SPLICE_FINALIZED channel was not spliced from the accepted channel');
  }
  if (
    typeof payload.txId === 'string'
    && typeof channel.spliceFundingTxId === 'string'
    && normalizeHex(channel.spliceFundingTxId) !== normalizeHex(payload.txId)
  ) {
    throw new Error('SPLICE_FINALIZED txId does not match the channel funding transaction');
  }

  // CAN-019: identifiers alone are not enough. Compare the resulting channel
  // with the totals and split this host signed for the splice.
  if (expectations) {
    const expected = expectations.get(payload.spliceId);
    if (!expected) {
      throw new Error(`SPLICE_FINALIZED for splice ${payload.spliceId} has no locally signed expectation`);
    }
    const totalValue = amountBigInt(channel.totalValue);
    if (totalValue === null || totalValue !== expected.totalValue) {
      throw new Error('SPLICE_FINALIZED totalValue does not match the locally signed splice');
    }
    if (!sameAmountMap(channel.balances as unknown as Record<string, unknown>, expected.balances)) {
      throw new Error('SPLICE_FINALIZED balances do not match the locally signed splice');
    }
    if (localChannel) {
      // Rebuild from the local channel: a splice changes the coin, total and
      // split, never the local state history or signer material.
      const reconstructed = {
        ...localChannel,
        totalValue: expected.totalValue,
        balances: { ...expected.balances },
        ...(typeof payload.txId === 'string' ? { spliceFundingTxId: payload.txId } : {}),
        splicedFrom: (channel as { splicedFrom?: string }).splicedFrom ?? localChannel.channelId,
        ...((channel as { fundingCoinId?: string }).fundingCoinId
          ? { fundingCoinId: (channel as { fundingCoinId?: string }).fundingCoinId }
          : {}),
      } as OmniaChannel;
      return { acceptance, channel: reconstructed };
    }
  }
  return { acceptance, channel };
}

/**
 * Validate VC_FINALIZED against the VC_PROPOSAL this host co-signed.
 *
 * Requires an outstanding acceptance for the virtual channel, the same kind and
 * factory, and a factory state that is a single-sequence successor of the copy
 * this host holds. That stops an unsolicited message from replacing factory
 * state wholesale or closing a channel this host never agreed to close.
 */
export function assertVcFinalized(input: {
  acceptances: ReadonlyMap<string, PendingVcAcceptance>;
  factories: ReadonlyMap<string, ChannelFactory>;
  hasChannel: (channelId: string) => boolean;
  payload: VcFinalizedPayload;
}): { acceptance: PendingVcAcceptance; factory: ChannelFactory } {
  const { acceptances, factories, hasChannel, payload } = input;

  const kind = payload.kind;
  if (kind !== 'vc-open' && kind !== 'vc-close') {
    throw new Error('VC_FINALIZED has an unknown kind');
  }
  const vcId = kind === 'vc-open' ? payload.channel?.channelId : payload.channelId;
  if (typeof vcId !== 'string' || vcId.length === 0) {
    throw new Error('VC_FINALIZED without a virtual-channel id');
  }

  const acceptance = acceptances.get(vcId);
  if (!acceptance) {
    throw new Error(`VC_FINALIZED for ${vcId} has no matching local acceptance`);
  }
  if (acceptance.kind !== kind) {
    throw new Error(`VC_FINALIZED kind '${kind}' does not match the accepted proposal '${acceptance.kind}'`);
  }

  const factory = payload.factory;
  if (!factory || factory.factoryId !== acceptance.factoryId) {
    throw new Error('VC_FINALIZED factory does not match the accepted factory');
  }

  const local = factories.get(acceptance.factoryId);
  if (!local) {
    throw new Error(`VC_FINALIZED names factory ${acceptance.factoryId}, which this host does not hold`);
  }
  if (factory.currentSequence !== local.currentSequence + 1) {
    throw new Error(
      `VC_FINALIZED factory sequence ${factory.currentSequence} is not the successor of local ${local.currentSequence}`,
    );
  }

  // CAN-019: compare the resulting state with what this host co-signed.
  const expected = acceptance.expected;
  if (expected?.factoryAllocations && !sameAmountMap(
    factory.allocations as unknown as Record<string, unknown>,
    expected.factoryAllocations,
  )) {
    throw new Error('VC_FINALIZED factory allocations do not match the locally signed proposal');
  }
  if (kind === 'vc-open' && payload.channel) {
    if (expected?.totalValue !== undefined && amountBigInt(payload.channel.totalValue) !== expected.totalValue) {
      throw new Error('VC_FINALIZED channel totalValue does not match the locally signed proposal');
    }
    if (!sameAmountMap(
      payload.channel.balances as unknown as Record<string, unknown>,
      expected?.balances,
    )) {
      throw new Error('VC_FINALIZED channel balances do not match the locally signed proposal');
    }
  }

  if (!expected?.factoryAllocations) {
    throw new Error('VC_FINALIZED has no locally signed allocation set');
  }

  // Rebuild the successor from the local factory and the allocation this host
  // co-signed. The peer object is an assertion to check, never the thing we
  // store: sequence, log and the VC set are derived here.
  const nextSequence = local.currentSequence + 1;
  const virtualChannelIds = kind === 'vc-open'
    ? [...(local.virtualChannels ?? []).map((vc) => vc.channelId), vcId]
    : (local.virtualChannels ?? []).filter((vc) => vc.channelId !== vcId).map((vc) => vc.channelId);

  let openedChannel: OmniaChannel | undefined;
  if (kind === 'vc-open') {
    if (!payload.channel) throw new Error('VC_FINALIZED vc-open carries no channel');
    if (payload.channel.channelId !== vcId) {
      throw new Error('VC_FINALIZED channel id does not match the accepted proposal');
    }
    if (payload.channel.tokenId !== local.tokenId) {
      throw new Error('VC_FINALIZED channel token does not match the factory');
    }
    const parties = payload.channel.parties ?? [];
    if (parties.length !== 2 || !parties.some((party) => party.partyId === acceptance.localPartyId)) {
      throw new Error('VC_FINALIZED channel parties do not match the accepted proposal');
    }
    if (!factory.virtualChannels.some((vc) => vc.channelId === vcId)) {
      throw new Error('VC_FINALIZED opens a virtual channel that the finalized factory does not contain');
    }
    openedChannel = {
      ...payload.channel,
      balances: { ...(expected.balances ?? payload.channel.balances) },
      totalValue: expected.totalValue ?? payload.channel.totalValue,
    };
  } else if (!hasChannel(vcId)) {
    throw new Error('VC_FINALIZED closes a channel this host does not hold');
  }

  const next: ChannelFactory = {
    ...local,
    currentSequence: nextSequence,
    allocations: { ...expected.factoryAllocations },
    virtualChannels: kind === 'vc-open'
      ? [...(local.virtualChannels ?? []), openedChannel as OmniaChannel]
      : (local.virtualChannels ?? []).filter((vc) => vc.channelId !== vcId),
    stateLog: [
      ...(local.stateLog ?? []),
      {
        sequence: nextSequence,
        timestamp: Date.now(),
        event: kind === 'vc-open' ? 'virtual_open' : 'virtual_close',
        allocations: { ...expected.factoryAllocations },
        virtualChannelIds,
      },
    ],
  };

  return { acceptance, factory: next };
}

/**
 * Validate an off-chain factory proposal.
 *
 * An off-chain factory has no funding transaction, so there are no funding
 * materials to rebuild. The proposal is bound by its state commitment, which
 * commits to the factoryId, sequence and allocations. Recompute it here instead
 * of requiring materials the peer cannot supply.
 */
export function assertOffChainFactoryCommitment(factory: ChannelFactory): void {
  if (!factory.pendingCommitment) {
    throw new Error('off-chain factory proposal has no commitment');
  }
  if (!factory.factoryId) {
    throw new Error('off-chain factory proposal has no factoryId');
  }
  const sum = Object.values(factory.allocations ?? {}).reduce((a, b) => a + b, 0n);
  if (sum !== factory.totalValue) {
    throw new Error(
      `off-chain factory proposal violates conservation: allocations(${sum}) !== totalValue(${factory.totalValue})`,
    );
  }
  const expected = computeFactoryStateCommitment(factory.factoryId, 1, factory.allocations, []);
  if (normalizeHex(factory.pendingCommitment) !== normalizeHex(Buffer.from(expected).toString('hex'))) {
    throw new Error('off-chain factory proposal commitment does not match its terms');
  }
}

function jsonSafeForCompare(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafeForCompare);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, jsonSafeForCompare(v)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

/**
 * A peer may only ask this host to sign the settlement its local factory
 * produces. Compare the peer's draft to the rebuilt canonical draft before any
 * WOTS leaf is reserved.
 */
export function assertFactorySettlementDraft(
  expected: { settlementDraft: unknown; settlementTxHex: string; txDigest: Uint8Array },
  proposed: { settlementDraft?: unknown; settlementTxHex?: unknown; txDigest?: unknown },
): void {
  if (!proposed || !(proposed.txDigest instanceof Uint8Array)) {
    throw new Error('factory settlement proposal carries no tx digest');
  }
  if (normalizeHex(Buffer.from(expected.txDigest).toString('hex')) !== normalizeHex(Buffer.from(proposed.txDigest).toString('hex'))) {
    throw new Error('factory settlement proposal digest does not match the local factory');
  }
  if (typeof proposed.settlementTxHex !== 'string'
      || normalizeHex(proposed.settlementTxHex) !== normalizeHex(expected.settlementTxHex)) {
    throw new Error('factory settlement proposal transaction does not match the local factory');
  }
  if (JSON.stringify(jsonSafeForCompare(proposed.settlementDraft))
      !== JSON.stringify(jsonSafeForCompare(expected.settlementDraft))) {
    throw new Error('factory settlement proposal draft does not match the local factory');
  }
}


/**
 * OMN-026: a peer may be cached for a channel only when its authenticated
 * identity is one of that channel's registered counterparties.
 */
export function isChannelPeer(
  channel: Pick<OmniaChannel, 'parties'>,
  peerPubkey: string | undefined,
  localPublicKeyDigest?: string,
): boolean {
  const normalize = (value: string | undefined): string =>
    (value ?? '').replace(/^0x/i, '').toLowerCase();
  const peer = normalize(peerPubkey);
  if (!peer) return false;
  if (localPublicKeyDigest && peer === normalize(localPublicKeyDigest)) return false;
  return channel.parties.some((party) => normalize(party.publicKeyDigest) === peer);
}
