/**
 * Multi-hop HTLC forwarder (RFC-035 B4, intermediary role).
 *
 * An intermediary that receives an offered HTLC carrying a routing envelope:
 *   - peels one hop (`RoutingEnvelopeCodec`),
 *   - locks an HTLC on its outgoing channel to the next hop (same hashlock,
 *     decreasing timeout), and forwards the remaining envelope; and
 *   - when the preimage is revealed on the outgoing hop, fulfils its incoming
 *     HTLC, propagating the preimage backward.
 *
 * The routing envelope is opaque; the cleartext codec ships today and an onion
 * codec slots in behind the same seam.
 *
 * Integration hook: the wallet's channel message handling calls
 * `forwardIncoming(...)` when an inbound STATE_UPDATE carries `payload.forward`
 * ({ hashlock, envelope }), and `revealPreimage(...)` when an outgoing HTLC it
 * locked is fulfilled.
 */

import { addHTLC, fulfillHTLC } from '@totemsdk/omnia';
import type { OmniaChannel, ChannelSigner, OmniaSwarm } from '@totemsdk/omnia';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import {
  createCleartextRoutingCodec,
  type RoutingEnvelopeCodec,
} from '@totemsdk/omnia-router';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';

/**
 * Durable link journal. The forwarder records the incoming→outgoing HTLC
 * association before sending the outgoing state update, so a restart can
 * reconcile a pending outgoing lock instead of losing it.
 */
export interface HtlcLinkJournal {
  get(hashlock: string): Promise<HtlcLink | undefined> | HtlcLink | undefined;
  record(link: HtlcLink): Promise<void> | void;
  remove(hashlock: string): Promise<void> | void;
}

export interface MultiHopForwarderOptions {
  /** This wallet's channels (updated in place). */
  channels: Map<string, OmniaChannel>;
  leaseProvider: WotsLeaseProvider;
  signer: ChannelSigner;
  /** Chain view used to refuse fulfilling an expired HTLC. */
  chainProvider: ChainStateProvider;
  swarm: OmniaSwarm;
  /** Envelope codec; defaults to the cleartext codec. */
  codec?: RoutingEnvelopeCodec;
  onForward?: (info: { hashlock: string; via: string; outChannelId: string; outHtlcId: string }) => void;
  onSettled?: (info: { hashlock: string; inChannelId: string; inHtlcId: string }) => void;
  /** Durable link journal; defaults to an in-memory map for tests. */
  linkJournal?: HtlcLinkJournal;
}

export interface ForwardIncomingParams {
  inChannelId: string;
  inHtlcId: string;
  hashlock: string;
  /** The opaque routing envelope carried with the incoming HTLC. */
  envelope: string;
  /** Absolute timeout (block) for the outgoing HTLC (envelope may override). */
  timeoutBlock?: bigint;
}

export type ForwardIncomingResult =
  | { status: 'final' }
  | { status: 'forwarded'; outChannelId: string; outHtlcId: string };

export type RevealPreimageResult =
  | { status: 'settled'; inChannelId: string }
  | { status: 'unknown' };

export interface HtlcLink {
  inChannelId: string;
  inHtlcId: string;
  outChannelId: string;
  outHtlcId: string;
  via: string;
}

export interface MultiHopForwarder {
  forwardIncoming(params: ForwardIncomingParams): Promise<ForwardIncomingResult>;
  revealPreimage(hashlock: string, preimage: string): Promise<RevealPreimageResult>;
  links(): ReadonlyMap<string, HtlcLink>;
}

export function createMultiHopForwarder(options: MultiHopForwarderOptions): MultiHopForwarder {
  const codec = options.codec ?? createCleartextRoutingCodec();
  const self = { publicKeyDigest: options.signer.publicKeyDigest };
  const links = new Map<string, HtlcLink>();

  const findChannelTo = (via: string, channelId?: string): OmniaChannel | undefined => {
    if (channelId) {
      const explicit = options.channels.get(channelId);
      if (explicit) return explicit;
    }
    for (const channel of options.channels.values()) {
      const hasSelf = channel.parties.some((p) => p.publicKeyDigest === self.publicKeyDigest);
      const hasVia = channel.parties.some((p) => p.publicKeyDigest === via);
      if (hasSelf && hasVia) return channel;
    }
    return undefined;
  };

  const forwardIncoming = async (params: ForwardIncomingParams): Promise<ForwardIncomingResult> => {
    const inChannel = options.channels.get(params.inChannelId);
    if (!inChannel) throw new Error(`incoming channel ${params.inChannelId} not found`);
    if (inChannel.status !== 'active') throw new Error(`incoming channel ${params.inChannelId} is ${inChannel.status}`);
    const inHtlc = inChannel.pendingHTLCs.find(h => h.htlcId === params.inHtlcId);
    if (!inHtlc) throw new Error(`incoming HTLC ${params.inHtlcId} not found`);
    if (inHtlc.status !== 'pending') throw new Error(`incoming HTLC ${params.inHtlcId} is ${inHtlc.status}`);
    if (inHtlc.direction !== 'received') throw new Error(`incoming HTLC ${params.inHtlcId} is not a received lock`);
    if (inHtlc.hashlock.toLowerCase() !== params.hashlock.toLowerCase()) {
      throw new Error(`incoming HTLC ${params.inHtlcId} hashlock does not match the forward`);
    }

    const peel = codec.peel(params.envelope, self);
    if (peel.kind === 'final') return { status: 'final' };

    const next = peel.next;
    const outChannel = findChannelTo(next.via, next.channelId);
    if (!outChannel) throw new Error(`no channel to next hop ${next.via}`);

    const timeoutBlock = next.timeoutBlock ?? params.timeoutBlock ?? 0n;
    if (timeoutBlock >= inHtlc.timeoutBlock) {
      throw new Error(
        `outgoing timeout ${timeoutBlock} must be earlier than incoming timeout ${inHtlc.timeoutBlock}`,
      );
    }
    if (next.amount > inHtlc.amount) {
      throw new Error(`outgoing amount ${next.amount} exceeds incoming amount ${inHtlc.amount}`);
    }
    if (links.has(params.hashlock) || await options.linkJournal?.get(params.hashlock)) {
      throw new Error(`duplicate forward for hashlock ${params.hashlock}`);
    }

    const result = await addHTLC(
      outChannel,
      {
        amount: next.amount,
        hashlock: params.hashlock,
        timeoutBlock,
        direction: 'offered',
        counterpartPublicKeyDigest: next.via,
      },
      options.leaseProvider,
      options.signer,
    );
    options.channels.set(result.channel.channelId, result.channel);

    const link: HtlcLink = {
      inChannelId: params.inChannelId,
      inHtlcId: params.inHtlcId,
      outChannelId: result.channel.channelId,
      outHtlcId: result.htlcId,
      via: next.via,
    };
    links.set(params.hashlock, link);
    await options.linkJournal?.record(link);

    const peer = await options.swarm.connectToPeer(next.via, result.channel.channelId);
    await peer.sendMessage({
      type: 'STATE_UPDATE',
      channelId: result.channel.channelId,
      nonce: Date.now(),
      payload: {
        ...result.partialState,
        ...(peel.onward ? { forward: { hashlock: params.hashlock, envelope: peel.onward } } : {}),
      },
    });

    options.onForward?.({
      hashlock: params.hashlock,
      via: next.via,
      outChannelId: result.channel.channelId,
      outHtlcId: result.htlcId,
    });

    return { status: 'forwarded', outChannelId: result.channel.channelId, outHtlcId: result.htlcId };
  };

  const revealPreimage = async (hashlock: string, preimage: string): Promise<RevealPreimageResult> => {
    const link = links.get(hashlock) ?? await options.linkJournal?.get(hashlock);
    if (!link) return { status: 'unknown' };
    const channel = options.channels.get(link.inChannelId);
    if (!channel) return { status: 'unknown' };

    const result = await fulfillHTLC(channel, link.inHtlcId, preimage, options.leaseProvider, options.chainProvider, options.signer);
    options.channels.set(result.channel.channelId, result.channel);
    links.delete(hashlock);
    await options.linkJournal?.remove(hashlock);

    options.onSettled?.({ hashlock, inChannelId: link.inChannelId, inHtlcId: link.inHtlcId });
    return { status: 'settled', inChannelId: link.inChannelId };
  };

  return { forwardIncoming, revealPreimage, links: () => links };
}
