/**
 * Integration layer: bridges OmniaSwarm message events to @totemsdk/omnia state machine calls.
 *
 * Message → function mapping:
 *   CHANNEL_PROPOSAL    → acceptChannel(proposal, chainProvider?)
 *   STATE_UPDATE        → verifyState(channel, state) + signState(channel, update, leaseProvider?)
 *   SETTLEMENT_PROPOSAL → proposeSettlement(channel, leaseProvider, opts?) when leaseProvider set
 */

import {
  acceptChannel,
  attachCounterpartySignature,
} from './channel.js';
import {
  verifyState,
  verifyStateForCoSign,
  signState,
} from './sign.js';
import {
  proposeSettlement,
  signSettlementRequest,
  type SettlementSigningRequest,
} from './settlement.js';
import type {
  OmniaChannel,
  ChannelProposal,
  SignedChannelState,
  ChannelSigner,
} from './types.js';
import type {
  OmniaPeer,
  OmniaMessage,
  OmniaSwarm,
  Unsubscribe,
} from './messaging-types.js';
import { canonicalizeProgramTransition } from './transition.js';
import { bytesToHex, hexToBytes, sha3_256 } from '@totemsdk/core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WotsLeaseProviderLike = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MinimalChainProvider = any;

export interface CoSignRequest {
  readonly channel: OmniaChannel;
  readonly state: SignedChannelState;
  readonly localPartyId: string;
  readonly peerPubkey?: string;
  readonly localBalanceBefore: bigint;
  readonly localBalanceAfter: bigint;
  readonly addedHtlcIds: readonly string[];
  readonly removedHtlcIds: readonly string[];
}

export interface CoSignDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

/** Application-supplied consent decision for an inbound peer state. */
export interface CoSignPolicy {
  authorize(request: CoSignRequest): Promise<CoSignDecision> | CoSignDecision;
}

/**
 * Safe default: never co-sign a local balance decrease or the removal of a
 * local pending HTLC. Applications may install a narrower policy that approves
 * specific receive/forward/refund effects.
 */
export const defaultCoSignPolicy: CoSignPolicy = {
  authorize(request) {
    if (request.localBalanceAfter < request.localBalanceBefore) {
      return { allowed: false, reason: 'local balance would decrease' };
    }
    if (request.removedHtlcIds.length > 0) {
      return { allowed: false, reason: 'a pending HTLC would be removed' };
    }
    return { allowed: true };
  },
};

export interface OmniaIntegrationConfig {
  leaseProvider?: WotsLeaseProviderLike;
  signer?: ChannelSigner;
  chainProvider?: MinimalChainProvider;
  /** Consent policy for inbound peer states. Defaults to defaultCoSignPolicy. */
  coSignPolicy?: CoSignPolicy;
  onChannelAccepted?: (channel: OmniaChannel, peer: OmniaPeer) => void;
  onStateUpdated?: (channel: OmniaChannel, peer: OmniaPeer) => void;
  /**
   * A peer revealed an HTLC preimage in a STATE_UPDATE. Relay wallets use this
   * to fulfil the matching upstream HTLC and continue the backward settlement
   * walk. The callback is observational; the signature already proved the
   * fulfilment.
   */
  onPreimageRevealed?: (event: {
    preimage: string;
    hashlock: string;
    channel: OmniaChannel;
    htlcId?: string;
    peerPubkey: string;
  }) => void | Promise<void>;
  onSettlementProposed?: (payload: unknown, peer: OmniaPeer) => void;
  /**
   * OMN-028: durable replay store for settlement co-signatures. Keyed by
   * `settlement-sign:<channel>:<sequence>:<digest>` and
   * `settlement-seq:<channel>:<sequence>`. When omitted, an in-memory bounded
   * cache still prevents duplicate leaf use within one process.
   */
  settlementReplayStore?: {
    get<T>(key: string): Promise<T | null> | T | null;
    set<T>(key: string, value: T): Promise<void> | void;
  };
  /**
   * Factory coordination messages (FACTORY_PROPOSAL/ACCEPT, FACTORY_CLOSE_*).
   * The host supplies these handlers (it owns the factory SDK + lease bundles);
   * the transport core stays free of factory dependencies.
   */
  onFactoryMessage?: (peer: OmniaPeer, msg: OmniaMessage) => void | Promise<void>;
  /** Virtual-channel coordination messages (VC_PROPOSAL/ACCEPT/FINALIZED). */
  onVcMessage?: (peer: OmniaPeer, msg: OmniaMessage) => void | Promise<void>;
  /** Splice coordination messages (SPLICE_PROPOSAL/ACCEPT/FINALIZED). */
  onSpliceMessage?: (peer: OmniaPeer, msg: OmniaMessage) => void | Promise<void>;
  /** Observe every inbound peer message, before lifecycle dispatch. */
  onPeerMessage?: (peer: OmniaPeer, msg: OmniaMessage) => void;
  /**
   * Test/dev escape hatch: allow a CHANNEL_PROPOSAL whose local/remote parties
   * are not bound to this signer and the authenticated peer. Never enable on a
   * network-facing host.
   */
  allowUnverifiedChannelProposal?: boolean;
  /**
   * OMN-061: authoritative chain height for validating `pending → timed_out`
   * HTLC transitions. Without it, an inbound state cannot time out an HTLC.
   */
  chainHeight?: number | bigint;
  /**
   * Test/dev: accept a contest delay below the default floor. The script embeds
   * the proposed delay, so settlement is only fast when this is set deliberately.
   */
  allowShortContestDelay?: boolean;
}


// ─────────────────────────────────────────────────────────────────────────────
// OMN-048 — inbound state updates are serialized per channel and identical
// retries reuse the reply instead of reserving fresh WOTS leaves.
// ─────────────────────────────────────────────────────────────────────────────
const stateUpdateChain = new WeakMap<object, Map<string, Promise<void>>>();
const stateUpdateReplies = new WeakMap<object, Map<string, unknown>>();

function stateReplyCache(config: OmniaIntegrationConfig): Map<string, unknown> {
  let cache = stateUpdateReplies.get(config);
  if (!cache) {
    cache = new Map();
    stateUpdateReplies.set(config, cache);
  }
  return cache;
}

function withChannelSerialization<T>(
  config: OmniaIntegrationConfig,
  channelId: string,
  fn: () => Promise<T>,
): Promise<T> {
  let chains = stateUpdateChain.get(config);
  if (!chains) {
    chains = new Map();
    stateUpdateChain.set(config, chains);
  }
  const previous = chains.get(channelId) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  chains.set(channelId, run.then(() => undefined, () => undefined));
  return run;
}

/**
 * Identity of an inbound state: the commitment the peer signed. Two messages
 * with the same identity must produce one signature, not two.
 */
function stateRequestKey(channelId: string, state: SignedChannelState): string {
  const htlcs = [...(Array.isArray(state.pendingHTLCs) ? state.pendingHTLCs : [])]
    .map((h) => [h.htlcId, h.amount.toString(), h.hashlock.toLowerCase(), h.timeoutBlock.toString(), h.status].join(':'))
    .sort();
  const balances = Object.entries(state.balances ?? {}).map(([k, v]) => `${k}:${String(v)}`).sort();
  const commitment = bytesToHex(sha3_256(new TextEncoder().encode([
    channelId,
    String(state.sequence),
    balances.join(','),
    htlcs.join(','),
  ].join('|'))));
  return `${channelId}:${state.sequence}:${commitment}`;
}

export type ChannelStore = Map<string, OmniaChannel>;

export function buildProgramTransitionStateUpdateMessage(
  channel: OmniaChannel,
  signedState: Partial<SignedChannelState>,
  nonce: number,
): OmniaMessage {
  return {
    type: 'STATE_UPDATE',
    channelId: channel.channelId,
    nonce,
    version: 1,
    payload: {
      ...signedState,
      programTransition: canonicalizeProgramTransition(signedState.programTransition),
    },
  };
}

export async function sendProgramTransitionStateUpdate(
  peer: OmniaPeer,
  channel: OmniaChannel,
  signedState: Partial<SignedChannelState>,
  nonce: number,
): Promise<void> {
  await peer.sendMessage(buildProgramTransitionStateUpdateMessage(channel, signedState, nonce));
}

/**
 * Wire an OmniaSwarm to @totemsdk/omnia function calls for the full channel lifecycle.
 */
export function createOmniaIntegration(
  swarm: OmniaSwarm,
  store: ChannelStore,
  config: OmniaIntegrationConfig = {},
): Unsubscribe {
  const boundPeers = new Set<OmniaPeer>();

  const FACTORY_TYPES = new Set<OmniaMessage['type']>([
    'FACTORY_PROPOSAL', 'FACTORY_ACCEPT', 'FACTORY_FUNDING_REQUEST',
    'FACTORY_FUNDING_RESPONSE', 'FACTORY_CLOSE_PROPOSAL',
    'FACTORY_CLOSE_ACCEPT', 'FACTORY_FINALIZED', 'FACTORY_CLOSE_FINALIZED',
  ]);
  const VC_TYPES = new Set<OmniaMessage['type']>([
    'VC_PROPOSAL', 'VC_ACCEPT', 'VC_FINALIZED',
  ]);
  const SPLICE_TYPES = new Set<OmniaMessage['type']>([
    'SPLICE_PROPOSAL', 'SPLICE_ACCEPT', 'SPLICE_FINALIZED',
  ]);

  const unsubListen = swarm.listenForChannels(
    (peer: OmniaPeer, msg: OmniaMessage) => {
      config.onPeerMessage?.(peer, msg);
      // Bind every peer on first contact, not only CHANNEL_PROPOSAL. Virtual
      // channels and factory openings arrive on peers that may never send a
      // CHANNEL_PROPOSAL, and their later STATE_UPDATEs must still be handled.
      const firstContact = !boundPeers.has(peer);
      if (firstContact) {
        boundPeers.add(peer);
        bindPeerIntegration(peer, store, config, { routeChannelProposal: false });
      }
      // The listener and the per-peer handler are separate subscriptions. The
      // first STATE_UPDATE on a newly-bound peer would otherwise be consumed by
      // this listener before the handler exists, so dispatch that one directly.
      if (firstContact && msg.type === 'STATE_UPDATE') {
        void _handleStateUpdate(peer, msg, store, config);
        return;
      }
      if (firstContact && msg.type === 'SETTLEMENT_PROPOSAL') {
        void _handleSettlementProposal(peer, msg, store, config);
        return;
      }
      if (msg.type === 'CHANNEL_PROPOSAL') {
        _handleChannelProposal(peer, msg, store, config, false);
        return;
      }
      if (FACTORY_TYPES.has(msg.type)) {
        void config.onFactoryMessage?.(peer, msg);
        return;
      }
      if (VC_TYPES.has(msg.type)) {
        void config.onVcMessage?.(peer, msg);
        return;
      }
      if (SPLICE_TYPES.has(msg.type)) {
        void config.onSpliceMessage?.(peer, msg);
      }
    },
  );

  return () => {
    boundPeers.clear();
    unsubListen();
  };
}

export interface BindPeerOptions {
  routeChannelProposal?: boolean;
}

/**
 * Register a per-peer message handler on an already-connected peer.
 */
export function bindPeerIntegration(
  peer: OmniaPeer,
  store: ChannelStore,
  config: OmniaIntegrationConfig = {},
  { routeChannelProposal = true }: BindPeerOptions = {},
): Unsubscribe {
  return peer.onMessage((msg: OmniaMessage) => {
    switch (msg.type) {
      case 'CHANNEL_PROPOSAL':
        if (!routeChannelProposal) break;
        _handleChannelProposal(peer, msg, store, config, false);
        break;
      case 'STATE_UPDATE':
        _handleStateUpdate(peer, msg, store, config).catch(() => {
          _sendError(peer, msg.channelId, msg.nonce, 'STATE_UPDATE handler failed');
        });
        break;
      case 'SETTLEMENT_PROPOSAL':
        _handleSettlementProposal(peer, msg, store, config).catch(() => {
          _sendError(peer, msg.channelId, msg.nonce, 'SETTLEMENT_PROPOSAL handler failed');
        });
        break;
      default:
        break;
    }
  });
}

// ── Private handlers ──────────────────────────────────────────────────────────


/** OMN-040: exact allocation comparison for idempotent opening replays. */
function sameAllocation(
  actual: Record<string, bigint> | undefined,
  expected: Record<string, bigint>,
): boolean {
  if (!actual) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (actualKeys.length !== expectedKeys.length) return false;
  return expectedKeys.every((key, index) =>
    actualKeys[index] === key && actual[key] === expected[key]);
}

async function _handleChannelProposal(
  peer: OmniaPeer,
  msg: OmniaMessage,
  store: ChannelStore,
  config: OmniaIntegrationConfig,
  bindPeer: boolean,
): Promise<void> {
  try {
    const proposal = msg.payload as ChannelProposal;
    const enforcing = Boolean(config.signer || config.leaseProvider)
      && config.allowUnverifiedChannelProposal !== true;
    if (enforcing && (!proposal.localParty || !proposal.remoteParty || !config.signer?.publicKeyDigest)) {
      throw new Error('Proposal cannot be bound: local signing identity is missing');
    }
    const existing = store.get(proposal.channelId);
    if (existing) {
      // OMN-040: an opening proposal is never authority to reset an existing
      // channel. Accept an exact duplicate as a retry; reject changed terms.
      const localPartyId = proposal.localParty.partyId;
      const remotePartyId = proposal.remoteParty.partyId;
      const proposedAllocation: Record<string, bigint> = {
        [localPartyId]: proposal.localAmount,
        [remotePartyId]: proposal.remoteAmount,
      };
      const originalAllocation = existing.openingBalances
        ?? (existing.currentSequence === 0 ? existing.balances : existing.stateLog.find((entry) => entry.event === 'open')?.balances);
      const sameParties = existing.parties.length === 2
        && existing.parties.some((party) => party.partyId === localPartyId)
        && existing.parties.some((party) => party.partyId === remotePartyId);
      const sameTerms = sameParties
        && existing.fundingCoinId === proposal.fundingCoinId
        && existing.fundingScript === proposal.fundingScript
        && existing.tokenId === proposal.tokenId
        && (proposal.tokenScale ?? 0) === (existing.tokenScale ?? 0)
        && existing.totalValue === proposedAllocation[localPartyId] + proposedAllocation[remotePartyId]
        && sameAllocation(originalAllocation, proposedAllocation);
      if (!sameTerms) {
        throw new Error('CHANNEL_PROPOSAL would replace an existing channel with different opening terms');
      }
      if (bindPeer) bindPeerIntegration(peer, store, config);
      _sendAck(peer, existing.channelId, msg.nonce);
      config.onChannelAccepted?.(existing, peer);
      return;
    }
    if (process.env.OMNIA_DEBUG) {
      console.error('[omnia-integration] acceptChannel start', proposal.channelId, 'coin', proposal.fundingCoinId);
    }
    const channel = await acceptChannel(proposal, config.chainProvider, 1, {
      localPublicKeyDigest: enforcing ? config.signer?.publicKeyDigest : undefined,
      // `peer.pubkey` is the authenticated transport identity of the proposer.
      remoteTransportPubkey: enforcing ? peer.pubkey : undefined,
      requireChainProvider: enforcing,
      allowShortContestDelay: config.allowShortContestDelay
        ?? process.env.OMNIA_ALLOW_SHORT_CONTEST_DELAY === '1',
    });
    if (process.env.OMNIA_DEBUG) {
      console.error('[omnia-integration] acceptChannel done', proposal.channelId, channel.status);
    }
    store.set(channel.channelId, channel);

    if (bindPeer) {
      bindPeerIntegration(peer, store, config);
    }

    _sendAck(peer, channel.channelId, msg.nonce);
    config.onChannelAccepted?.(channel, peer);
  } catch (err) {
    console.error(
      '[omnia-integration] channel proposal rejected:',
      err instanceof Error ? (err.stack ?? err.message) : String(err),
    );
    _sendError(
      peer,
      msg.channelId,
      msg.nonce,
      `acceptChannel failed: ${String(err)}`,
    );
  }
}

async function _handleStateUpdate(
  peer: OmniaPeer,
  msg: OmniaMessage,
  store: ChannelStore,
  config: OmniaIntegrationConfig,
): Promise<void> {
  const channel = store.get(msg.channelId);
  if (!channel) {
    _sendError(peer, msg.channelId, msg.nonce, `Unknown channel: ${msg.channelId}`);
    return;
  }

  const signedState = msg.payload as SignedChannelState;
  signedState.programTransition = canonicalizeProgramTransition(signedState.programTransition);

  // OMN-048: an identical retry gets the recorded reply; it must not reserve a
  // second pair of WOTS leaves for the same sequence and commitment.
  const cachedReply = stateReplyCache(config).get(stateRequestKey(msg.channelId, signedState));
  if (cachedReply) {
    await peer.sendMessage({
      type: 'ACK',
      channelId: msg.channelId,
      nonce: msg.nonce,
      payload: cachedReply,
    });
    return;
  }
  // STATE_UPDATE may carry new pending HTLCs that the receiver does not have yet.
  // Apply them to the working channel before verification/signing so the co-sign
  // commitment matches the sender's payload.
  const channelForState: OmniaChannel = signedState.pendingHTLCs
    ? { ...channel, pendingHTLCs: signedState.pendingHTLCs }
    : channel;
  // OMN-038: verify against the PERSISTED channel, never the proposed state.
  // The proposed HTLC set is only used for digest/signature construction; using
  // it for verification would compare changed HTLC terms with themselves.
  // OMN-061: a terminal HTLC transition needs the preimage (fulfilled) or the
  // authoritative height (timed out); both travel with the message.
  const revealedPreimage = (signedState as unknown as { preimage?: unknown }).preimage;
  const verifyOptions = {
    ...(typeof revealedPreimage === 'string' || revealedPreimage instanceof Uint8Array
      ? { preimage: revealedPreimage }
      : {}),
    ...(config.chainHeight !== undefined ? { chainHeight: config.chainHeight } : {}),
  };
  const result = config.leaseProvider
    ? await verifyStateForCoSign(channel, signedState, verifyOptions)
    : await verifyState(channel, signedState, verifyOptions);
  if (!result.valid) {
    if (process.env.OMNIA_DEBUG) console.error('[integration] STATE_UPDATE invalid', msg.channelId, result.errors);
    _sendError(
      peer,
      msg.channelId,
      msg.nonce,
      `STATE_UPDATE verification failed: ${result.errors.join('; ')}`,
    );
    return;
  }

  const localDigest = config.signer?.publicKeyDigest ?? channel.localSigner?.publicKeyDigest;
  const localParty = localDigest
    ? channel.parties.find(p => p.publicKeyDigest === localDigest)
    : undefined;
  if (config.leaseProvider && localParty) {
    const previousIds = new Set(channel.pendingHTLCs.map(h => h.htlcId));
    const nextIds = new Set(signedState.pendingHTLCs.map(h => h.htlcId));
    const addedHtlcIds = [...nextIds].filter(id => !previousIds.has(id));
    const removedHtlcIds = [...previousIds].filter(id => !nextIds.has(id));
    const decision = await (config.coSignPolicy ?? defaultCoSignPolicy).authorize({
      channel,
      state: signedState,
      localPartyId: localParty.partyId,
      peerPubkey: peer.pubkey,
      localBalanceBefore: channel.balances[localParty.partyId] ?? 0n,
      localBalanceAfter: signedState.balances[localParty.partyId] ?? 0n,
      addedHtlcIds,
      removedHtlcIds,
    });
    if (!decision.allowed) {
      _sendError(peer, msg.channelId, msg.nonce, `co-sign denied: ${decision.reason ?? 'policy'}`);
      return;
    }
  }

  if (config.leaseProvider) {
    const requestKey = stateRequestKey(msg.channelId, signedState);
    return await withChannelSerialization(config, msg.channelId, async () => {
    try {
      const partialState = await signState(
        channelForState,
        {
          newSequence: signedState.sequence,
          newBalances: signedState.balances,
          programTransition: signedState.programTransition,
        },
        config.leaseProvider,
        config.signer,
      );
      let mergedChannel: OmniaChannel | undefined;
      const remotePartyId = Object.keys(signedState.signatures ?? {})[0];
      if (remotePartyId && partialState.signatures && partialState.signingIndices) {
        const localPartyId = Object.keys(partialState.signatures)[0];
        if (localPartyId) {
          const merged = attachCounterpartySignature(
            channelForState,
            partialState,
            remotePartyId,
            signedState.signatures[remotePartyId],
            signedState.signingIndices[remotePartyId],
            signedState.closePackage,
          );
          mergedChannel = merged.channel;
        }
      }
      // OMN-039: persist the merged state BEFORE acknowledging it. A crash
      // between signing and persistence used to leave the peer holding a
      // signature our store had forgotten.
      const nextChannel: OmniaChannel = mergedChannel ?? {
        ...channelForState,
        latestState: signedState,
        currentSequence: signedState.sequence,
        balances: signedState.balances,
        updatedAt: Date.now(),
      };
      store.set(msg.channelId, nextChannel);
      const ackPayload = {
        ok: true,
        partialState,
        counterpartyPartialState: partialState,
        counterpartyClosePackage: partialState.closePackage,
      };
      stateReplyCache(config).set(requestKey, ackPayload);
      await peer.sendMessage({
        type: 'ACK',
        channelId: msg.channelId,
        nonce: msg.nonce,
        payload: ackPayload,
      });
      if (process.env.OMNIA_DEBUG) console.error('[integration] STATE_UPDATE merged', msg.channelId, nextChannel.currentSequence, nextChannel.pendingHTLCs.length);
      config.onStateUpdated?.(nextChannel, peer);
      const revealed = (signedState as unknown as { preimage?: unknown }).preimage;
      if (typeof revealed === 'string' && /^(0x)?[0-9a-fA-F]{64}$/.test(revealed)) {
        const normalized = '0x' + revealed.replace(/^0x/i, '').toLowerCase();
        const hashlock = '0x' + bytesToHex(sha3_256(hexToBytes(normalized)));
        const htlc = nextChannel.pendingHTLCs.find(
          (h) => h.hashlock.toLowerCase() === hashlock && h.status === 'pending',
        );
        void config.onPreimageRevealed?.({
          preimage: normalized,
          hashlock,
          channel: nextChannel,
          ...(htlc ? { htlcId: htlc.htlcId } : {}),
          peerPubkey: peer.pubkey,
        });
      }
      return;
    } catch (err) {
      _sendError(peer, msg.channelId, msg.nonce, `signState failed: ${String(err)}`);
      return;
    }
    });
  } else {
    _sendAck(peer, msg.channelId, msg.nonce);
  }

  const updatedChannel: OmniaChannel = {
    ...channelForState,
    latestState: signedState,
    currentSequence: signedState.sequence,
    balances: signedState.balances,
    updatedAt: Date.now(),
  };
  store.set(msg.channelId, updatedChannel);

  config.onStateUpdated?.(updatedChannel, peer);
}

interface SettlementSignResponse {
  ok: true;
  signRequest: true;
  partyId: string;
  signature: string;
  indices: unknown;
}

const settlementReplayByConfig = new WeakMap<object, Map<string, SettlementSignResponse>>();
const settlementSequenceByConfig = new WeakMap<object, Map<string, string>>();
const SETTLEMENT_REPLAY_LIMIT = 256;

function settlementReplay(config: OmniaIntegrationConfig): Map<string, SettlementSignResponse> {
  let cache = settlementReplayByConfig.get(config);
  if (!cache) {
    cache = new Map();
    settlementReplayByConfig.set(config, cache);
  }
  return cache;
}

function settlementSequences(config: OmniaIntegrationConfig): Map<string, string> {
  let cache = settlementSequenceByConfig.get(config);
  if (!cache) {
    cache = new Map();
    settlementSequenceByConfig.set(config, cache);
  }
  return cache;
}

function rememberSign(
  config: OmniaIntegrationConfig,
  signKey: string,
  seqKey: string,
  digest: string,
  response: SettlementSignResponse,
): void {
  const cache = settlementReplay(config);
  cache.set(signKey, response);
  while (cache.size > SETTLEMENT_REPLAY_LIMIT) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
  settlementSequences(config).set(seqKey, digest);
}

async function _handleSettlementProposal(
  peer: OmniaPeer,
  msg: OmniaMessage,
  store: ChannelStore,
  config: OmniaIntegrationConfig,
): Promise<void> {
  const channel = store.get(msg.channelId);

  if (config.leaseProvider && !channel) {
    _sendError(peer, msg.channelId, msg.nonce, `Unknown channel: ${msg.channelId}`);
    return;
  }

  if (config.leaseProvider && channel) {
    const payload = msg.payload as Partial<SettlementSigningRequest> & { signRequest?: boolean };
    // Cooperative close: the initiator asks us to co-sign a specific settlement
    // draft (both signatures are required by the eltoo MULTISIG(2 …) branch).
    // We sign and ACK; the initiator broadcasts.
    if (payload?.signRequest === true && typeof payload.settlementTxHex === 'string') {
      const digest = String((payload as { digestHex?: unknown }).digestHex ?? '').toLowerCase();
      const seqKey = `${msg.channelId}:${String((payload as { sequence?: unknown }).sequence)}`;
      const signKey = `${seqKey}:${digest}`;
      const replay = settlementReplay(config);
      try {
        // OMN-028: an identical request reuses the existing co-signature; a
        // different settlement for the same channel+sequence is a conflict.
        const durable = config.settlementReplayStore
          ? await config.settlementReplayStore.get<SettlementSignResponse>(`settlement-sign:${signKey}`)
          : null;
        const cached = durable ?? replay.get(signKey);
        if (cached) {
          await peer.sendMessage({
            type: 'ACK',
            channelId: msg.channelId,
            nonce: msg.nonce,
            payload: cached,
          });
          return;
        }
        const durableSeq = config.settlementReplayStore
          ? await config.settlementReplayStore.get<string>(`settlement-seq:${seqKey}`)
          : null;
        const priorDigest = durableSeq ?? settlementSequences(config).get(seqKey);
        if (priorDigest !== undefined && priorDigest !== digest) {
          throw new Error('conflicting settlement request for the same channel and sequence');
        }

        const coSig = await signSettlementRequest(
          channel,
          payload as SettlementSigningRequest,
          config.leaseProvider,
          config.signer,
        );
        const signatureHex = Array.from(coSig.signature)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        const response: SettlementSignResponse = {
          ok: true,
          signRequest: true,
          partyId: coSig.partyId,
          signature: '0x' + signatureHex,
          indices: coSig.indices,
        };
        rememberSign(config, signKey, seqKey, digest, response);
        if (config.settlementReplayStore) {
          await config.settlementReplayStore.set(`settlement-sign:${signKey}`, response);
          await config.settlementReplayStore.set(`settlement-seq:${seqKey}`, digest);
        }
        await peer.sendMessage({
          type: 'ACK',
          channelId: msg.channelId,
          nonce: msg.nonce,
          payload: response,
        });
      } catch (err) {
        _sendError(peer, msg.channelId, msg.nonce, `signSettlementRequest failed: ${String(err)}`);
      }
      return;
    }

    try {
      const { settlementPayload, partialState } = await proposeSettlement(
        channel,
        config.leaseProvider,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        msg.payload as any,
      );
      await peer.sendMessage({
        type: 'ACK',
        channelId: msg.channelId,
        nonce: msg.nonce,
        payload: { ok: true, settlementPayload, partialState },
      });
      config.onSettlementProposed?.(settlementPayload, peer);
    } catch (err) {
      _sendError(peer, msg.channelId, msg.nonce, `proposeSettlement failed: ${String(err)}`);
    }
  } else {
    config.onSettlementProposed?.(msg.payload, peer);
    _sendAck(peer, msg.channelId, msg.nonce);
  }
}

function _sendAck(peer: OmniaPeer, channelId: string, nonce: number): void {
  peer.sendMessage({
    type: 'ACK',
    channelId,
    nonce,
    payload: { ok: true },
  }).catch(() => { /* best-effort */ });
}

function _sendError(peer: OmniaPeer, channelId: string, nonce: number, reason: string): void {
  peer.sendMessage({
    type: 'ERROR',
    channelId,
    nonce,
    payload: { error: reason },
  }).catch(() => { /* best-effort */ });
}
