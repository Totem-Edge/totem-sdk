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
} from './channel.js';
import {
  verifyState,
  signState,
} from './sign.js';
import {
  proposeSettlement,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WotsLeaseProviderLike = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MinimalChainProvider = any;

export interface OmniaIntegrationConfig {
  leaseProvider?: WotsLeaseProviderLike;
  signer?: ChannelSigner;
  chainProvider?: MinimalChainProvider;
  onChannelAccepted?: (channel: OmniaChannel, peer: OmniaPeer) => void;
  onStateUpdated?: (channel: OmniaChannel, peer: OmniaPeer) => void;
  onSettlementProposed?: (payload: unknown, peer: OmniaPeer) => void;
}

export type ChannelStore = Map<string, OmniaChannel>;

/**
 * Wire an OmniaSwarm to @totemsdk/omnia function calls for the full channel lifecycle.
 */
export function createOmniaIntegration(
  swarm: OmniaSwarm,
  store: ChannelStore,
  config: OmniaIntegrationConfig = {},
): Unsubscribe {
  const boundPeers = new Set<OmniaPeer>();

  const unsubListen = swarm.listenForChannels(
    (peer: OmniaPeer, msg: OmniaMessage) => {
      if (msg.type === 'CHANNEL_PROPOSAL') {
        if (!boundPeers.has(peer)) {
          boundPeers.add(peer);
          bindPeerIntegration(peer, store, config, { routeChannelProposal: false });
        }
        _handleChannelProposal(peer, msg, store, config, false);
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

async function _handleChannelProposal(
  peer: OmniaPeer,
  msg: OmniaMessage,
  store: ChannelStore,
  config: OmniaIntegrationConfig,
  bindPeer: boolean,
): Promise<void> {
  try {
    const proposal = msg.payload as ChannelProposal;
    const channel = await acceptChannel(proposal, config.chainProvider);
    store.set(channel.channelId, channel);

    if (bindPeer) {
      bindPeerIntegration(peer, store, config);
    }

    _sendAck(peer, channel.channelId, msg.nonce);
    config.onChannelAccepted?.(channel, peer);
  } catch (err) {
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
  const result = await verifyState(channel, signedState);
  if (!result.valid) {
    _sendError(
      peer,
      msg.channelId,
      msg.nonce,
      `STATE_UPDATE verification failed: ${result.errors.join('; ')}`,
    );
    return;
  }

  const updatedChannel: OmniaChannel = {
    ...channel,
    latestState: signedState,
    currentSequence: signedState.sequence,
    balances: signedState.balances,
    updatedAt: Date.now(),
  };
  store.set(msg.channelId, updatedChannel);

  if (config.leaseProvider) {
    try {
      const partialState = await signState(
        updatedChannel,
        { newSequence: signedState.sequence, newBalances: signedState.balances },
        config.leaseProvider,
        config.signer,
      );
      await peer.sendMessage({
        type: 'ACK',
        channelId: msg.channelId,
        nonce: msg.nonce,
        payload: { ok: true, partialState },
      });
    } catch (err) {
      _sendError(peer, msg.channelId, msg.nonce, `signState failed: ${String(err)}`);
      return;
    }
  } else {
    _sendAck(peer, msg.channelId, msg.nonce);
  }

  config.onStateUpdated?.(updatedChannel, peer);
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
