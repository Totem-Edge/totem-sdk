/**
 * channelManager.js — Omnia L2 payment channels over the Axia hosted relay.
 *
 * Uses `createOmniaSwarm({ relay: { mode: 'hosted', apiKey } })` so all traffic
 * flows through a single WebSocket rather than raw Hyperswarm P2P. This is the
 * correct transport choice for Android: raw Hyperswarm needs a native binary that
 * is not available in the current Pear Android runtime.
 *
 * For Node.js / desktop Pear where the hyperswarm binary is available, swap
 * `mode: 'hosted'` for `mode: 'native'` and remove the apiKey.
 *
 * What this module provides:
 *   createChannelManager(config) → { openChannelTo, channelStore, close }
 *   - openChannelTo(remotePubkey, params) — propose a new payment channel
 *   - channelStore — live Map<channelId, OmniaChannel> (read-only from outside)
 *   - close() — tear down swarm + integration
 *
 * Inbound channels:
 *   The integration layer (createOmniaIntegration) handles CHANNEL_PROPOSAL,
 *   STATE_UPDATE, and SETTLEMENT_PROPOSAL automatically. Supply callbacks to
 *   be notified on each event.
 */

import { createOmniaSwarm } from '@totemsdk/omnia-hyperswarm';
import { createOmniaIntegration } from '@totemsdk/omnia-hyperswarm';
import { createChannel } from '@totemsdk/omnia';
import { createLogger } from '@totemsdk/pear';

export async function createChannelManager({
  axiaApiKey,
  localPubkey,
  leaseProvider,
  onChannelAccepted,
  onStateUpdated,
  onSettlementProposed,
}) {
  const log = createLogger('omnia');

  const swarm = await createOmniaSwarm({
    relay: { mode: 'hosted', apiKey: axiaApiKey },
    localPubkey,
  });

  const channelStore = new Map();

  const unsubIntegration = createOmniaIntegration(swarm, channelStore, {
    leaseProvider,
    onChannelAccepted(channel, peer) {
      log.info('Channel accepted', { channelId: channel.channelId, peer: peer.pubkey });
      onChannelAccepted?.(channel, peer);
    },
    onStateUpdated(channel, peer) {
      log.info('State updated', {
        channelId: channel.channelId,
        sequence: channel.currentSequence,
      });
      onStateUpdated?.(channel, peer);
    },
    onSettlementProposed(payload, peer) {
      log.info('Settlement proposed', { peer: peer.pubkey });
      onSettlementProposed?.(payload, peer);
    },
  });

  /**
   * Open a new payment channel to a remote peer.
   *
   * `params` mirrors CreateChannelParams from @totemsdk/omnia:
   *   {
   *     channelId: string,          // unique ID you choose, e.g. crypto.randomUUID()
   *     localAddress: string,       // your Minima address (Mx...)
   *     remoteAddress: string,      // counterparty Minima address
   *     localBalance: string,       // your opening balance (e.g. '10')
   *     remoteBalance: string,      // counterparty opening balance (e.g. '0')
   *     tokenId: string,            // '0x00' for native MIN
   *     localSigner: ChannelSigner, // created from @totemsdk/core TreeKey
   *   }
   *
   * Returns the new OmniaChannel and the connected OmniaPeer.
   */
  async function openChannelTo(remotePubkey, params) {
    const channel = createChannel(params);
    channelStore.set(channel.channelId, channel);

    const peer = await swarm.connectToPeer(remotePubkey, channel.channelId);

    await peer.sendMessage({
      type: 'CHANNEL_PROPOSAL',
      channelId: channel.channelId,
      nonce: 1,
      payload: {
        channelId: channel.channelId,
        localAddress: params.localAddress,
        remoteAddress: params.remoteAddress,
        localBalance: params.localBalance,
        remoteBalance: params.remoteBalance,
        tokenId: params.tokenId,
      },
    });

    log.info('Channel proposal sent', { channelId: channel.channelId, to: remotePubkey });
    return { channel, peer };
  }

  async function close() {
    unsubIntegration();
    await swarm.close();
    log.info('Channel manager closed');
  }

  return { channelStore, openChannelTo, close };
}
