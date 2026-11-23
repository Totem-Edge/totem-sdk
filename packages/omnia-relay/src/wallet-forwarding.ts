/**
 * RFC-035 B4 (wallet side) — bind the multi-hop forwarder to a wallet peer.
 *
 * The forwarder itself is transport-agnostic: it peels an envelope and locks the
 * outgoing HTLC. What was missing is the hook that recognises a forwarding
 * instruction when it arrives. A wallet receives `STATE_UPDATE` on its relay
 * peer; when the payload carries `forward: { hashlock, envelope }` this node is
 * an intermediary on that route.
 *
 * This module wires the two together and keeps the failure posture of the rest
 * of the coordination stack: an instruction that cannot be matched to a pending
 * received HTLC is reported, never guessed at, and a duplicate is refused rather
 * than locking a second outgoing HTLC for the same hashlock.
 */

import type { ChannelSigner, OmniaChannel, OmniaPeer, OmniaSwarm } from '@totemsdk/omnia';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { RoutingEnvelopeCodec } from '@totemsdk/omnia-router';
import {
  createMultiHopForwarder,
  type HtlcLinkJournal,
  type MultiHopForwarder,
} from './forwarder.js';

export interface WalletForwardingError {
  reason: 'unknown-channel' | 'no-pending-htlc' | 'invalid-forward' | 'forward-failed';
  channelId: string;
  hashlock?: string;
  error?: unknown;
}

export interface WalletForwardingOptions {
  /** The wallet's live channels; the forwarder updates them in place. */
  channels: Map<string, OmniaChannel>;
  signer: ChannelSigner;
  leaseProvider: WotsLeaseProvider;
  chainProvider: ChainStateProvider;
  swarm: OmniaSwarm;
  /** Durable journal; a volatile one would strand locked liquidity on restart. */
  linkJournal: HtlcLinkJournal;
  codec?: RoutingEnvelopeCodec;
  /**
   * Recipient-side preimage resolver. Wallets usually resolve from a pending
   * invoice; without it the final hop stays pending (explicit non-terminal).
   */
  resolvePreimage?: (hashlock: string) => Promise<string | undefined> | string | undefined;
  /** Observability hook; never used for control flow. */
  onError?: (info: WalletForwardingError) => void;
  onForward?: (info: { hashlock: string; via: string; outChannelId: string; outHtlcId: string }) => void;
  onSettled?: (info: { hashlock: string; inChannelId: string; inHtlcId: string }) => void;
}

export interface WalletForwarding {
  forwarder: MultiHopForwarder;
  /** Register the forwarding instruction handler for one peer. */
  bindPeer(peer: OmniaPeer): () => void;
  /** Detach every bound peer. */
  close(): void;
}

interface ForwardInstruction {
  hashlock: string;
  envelope: string;
}

function readForwardInstruction(payload: unknown): ForwardInstruction | null {
  if (!payload || typeof payload !== 'object') return null;
  const forward = (payload as { forward?: unknown }).forward;
  if (!forward || typeof forward !== 'object') return null;
  const { hashlock, envelope } = forward as { hashlock?: unknown; envelope?: unknown };
  if (typeof hashlock !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hashlock)) return null;
  if (typeof envelope !== 'string' || envelope.length === 0) return null;
  return { hashlock, envelope };
}

export function createWalletForwarding(options: WalletForwardingOptions): WalletForwarding {
  const forwarder = createMultiHopForwarder({
    channels: options.channels,
    signer: options.signer,
    leaseProvider: options.leaseProvider,
    chainProvider: options.chainProvider,
    swarm: options.swarm,
    linkJournal: options.linkJournal,
    ...(options.codec ? { codec: options.codec } : {}),
    ...(options.resolvePreimage ? { resolvePreimage: options.resolvePreimage } : {}),
    ...(options.onForward ? { onForward: options.onForward } : {}),
    ...(options.onSettled ? { onSettled: options.onSettled } : {}),
  });

  const unsubscribers = new Set<() => void>();

  const bindPeer = (peer: OmniaPeer): (() => void) => {
    const unsubscribe = peer.onMessage((message) => {
      // Channel state updates only: coordination kinds carry their own handlers.
      if (message.type !== 'STATE_UPDATE') return;
      const instruction = readForwardInstruction(message.payload);
      if (!instruction) return;

      const channel = options.channels.get(message.channelId);
      if (!channel) {
        options.onError?.({ reason: 'unknown-channel', channelId: message.channelId, hashlock: instruction.hashlock });
        return;
      }

      // The incoming HTLC is the anchor for the outgoing lock. Without a local,
      // pending, received HTLC the instruction cannot be honoured; guessing
      // (by amount or by recency) would lock liquidity against the wrong leg.
      const htlc = channel.pendingHTLCs.find(
        (candidate) =>
          candidate.status === 'pending'
          && candidate.direction === 'received'
          && candidate.hashlock.toLowerCase() === instruction.hashlock.toLowerCase(),
      );
      if (!htlc) {
        options.onError?.({ reason: 'no-pending-htlc', channelId: channel.channelId, hashlock: instruction.hashlock });
        return;
      }

      void forwarder
        .forwardIncoming({
          inChannelId: channel.channelId,
          inHtlcId: htlc.htlcId,
          hashlock: instruction.hashlock,
          envelope: instruction.envelope,
          timeoutBlock: htlc.timeoutBlock,
        })
        .catch((error: unknown) => {
          options.onError?.({
            reason: 'forward-failed',
            channelId: channel.channelId,
            hashlock: instruction.hashlock,
            error,
          });
        });
    });
    unsubscribers.add(unsubscribe);
    return () => {
      unsubscribers.delete(unsubscribe);
      unsubscribe();
    };
  };

  return {
    forwarder,
    bindPeer,
    close() {
      for (const unsubscribe of unsubscribers) unsubscribe();
      unsubscribers.clear();
    },
  };
}
