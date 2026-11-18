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
  /** Optional durable lookup by the incoming HTLC (replay detection). */
  getByIncoming?(params: {
    inChannelId: string;
    inHtlcId: string;
  }): Promise<HtlcLink | undefined> | HtlcLink | undefined;
  /** Optional recovery listing of every unresolved link. */
  list?(): Promise<HtlcLink[]> | HtlcLink[];
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
  /**
   * Durable link journal. Required: a volatile default would lose the
   * incoming→outgoing association on restart and strand locked liquidity.
   */
  linkJournal: HtlcLinkJournal;
  /**
   * Recipient-side preimage resolver. When the peeled envelope is the final
   * hop, a value here fulfils the incoming HTLC immediately and propagates the
   * preimage back to the previous hop.
   */
  resolvePreimage?: (hashlock: string) => Promise<string | undefined> | string | undefined;
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
  | { status: 'forwarded'; outChannelId: string; outHtlcId: string }
  | { status: 'settled'; inChannelId: string; inHtlcId: string };

export type RevealPreimageResult =
  | { status: 'settled'; inChannelId: string }
  | { status: 'unknown' };

export interface HtlcLink {
  /** Hashlock shared by the incoming and outgoing HTLCs. */
  hashlock: string;
  inChannelId: string;
  inHtlcId: string;
  outChannelId: string;
  /** Empty while the link is an intent (the outgoing HTLC id is not signed yet). */
  outHtlcId: string;
  via: string;
  /**
   * `intent` is written before the outgoing HTLC is signed (CAN-008);
   * `active` once the signed HTLC id is known.
   * OMN-006: `preimage-revealed` is written before fulfilling the incoming
   * HTLC; `backward-sent` once the preimage update has been sent. A link is not
   * removed while `preimage-revealed` — recovery must retry the backward send.
   */
  status?: 'intent' | 'active' | 'preimage-revealed' | 'backward-sent';
  /** OMN-006: preimage owed to the previous hop, journaled before fulfil. */
  preimage?: string;
  /** OMN-006: deterministic nonce so a retried backward send is deduplicated. */
  backwardNonce?: number;
}

export interface MultiHopForwarder {
  forwardIncoming(params: ForwardIncomingParams): Promise<ForwardIncomingResult>;
  revealPreimage(hashlock: string, preimage: string): Promise<RevealPreimageResult>;
  /**
   * Reconcile journaled links after a restart. A link is cleared only when its
   * INCOMING HTLC is no longer pending; an intent is completed from the outgoing
   * channel when the signed HTLC is present. Remaining links are returned for
   * the caller to reveal or time out.
   */
  recover(): Promise<HtlcLink[]>;
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
    if (peel.kind === 'final') {
      // Recipient hop: settle only when the application can supply the
      // preimage. Otherwise the HTLC stays pending and the caller sees an
      // explicit non-terminal `final` result.
      const preimage = await options.resolvePreimage?.(params.hashlock);
      if (!preimage) return { status: 'final' };
      // OMN-006: journal the final-hop delivery duty BEFORE fulfilling. A crash
      // after fulfil but before the upstream send is recoverable from here.
      const pending: HtlcLink = {
        hashlock: params.hashlock,
        inChannelId: params.inChannelId,
        inHtlcId: params.inHtlcId,
        outChannelId: '',
        outHtlcId: '',
        via: 'final',
        status: 'preimage-revealed',
        preimage,
        backwardNonce: Date.now(),
      };
      links.set(params.hashlock, pending);
      await options.linkJournal.record(pending);

      const fulfilled = await fulfillHTLC(
        inChannel,
        params.inHtlcId,
        preimage,
        options.leaseProvider,
        options.chainProvider,
        options.signer,
      );
      options.channels.set(fulfilled.channel.channelId, fulfilled.channel);

      try {
        await sendBackward(pending);
        const sent: HtlcLink = { ...pending, status: 'backward-sent' };
        links.set(params.hashlock, sent);
        await options.linkJournal.record(sent);
      } catch {
        // Keep the duty recoverable; recover() retries the same nonce.
      }
      options.onSettled?.({
        hashlock: params.hashlock,
        inChannelId: params.inChannelId,
        inHtlcId: params.inHtlcId,
      });
      return { status: 'settled', inChannelId: params.inChannelId, inHtlcId: params.inHtlcId };
    }

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
    const duplicate = links.has(params.hashlock)
      || Boolean(await options.linkJournal.get(params.hashlock))
      || Boolean(await options.linkJournal.getByIncoming?.({
        inChannelId: params.inChannelId,
        inHtlcId: params.inHtlcId,
      }));
    if (duplicate) {
      throw new Error(`duplicate forward for hashlock ${params.hashlock}`);
    }

    // CAN-008: journal the association BEFORE signing the outgoing HTLC. If the
    // process dies between the signature and the id, recovery still knows which
    // incoming payment this outgoing obligation belongs to.
    const intent: HtlcLink = {
      hashlock: params.hashlock,
      inChannelId: params.inChannelId,
      inHtlcId: params.inHtlcId,
      outChannelId: outChannel.channelId,
      outHtlcId: '',
      via: next.via,
      status: 'intent',
    };
    await options.linkJournal.record(intent);

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
      ...intent,
      outChannelId: result.channel.channelId,
      outHtlcId: result.htlcId,
      status: 'active',
    };
    links.set(params.hashlock, link);
    await options.linkJournal.record(link);

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

  const createBackwardPayload = (
    channel: OmniaChannel,
    preimage: string,
    fallback: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    ...(channel.latestState ? { ...channel.latestState } : fallback),
    preimage,
  });

  const sendBackward = async (link: HtlcLink): Promise<void> => {
    const channel = options.channels.get(link.inChannelId);
    if (!channel) throw new Error(`incoming channel ${link.inChannelId} is not loaded`);
    const previousHop = channel.parties.find(
      (p) => p.publicKeyDigest !== self.publicKeyDigest,
    );
    if (!previousHop) throw new Error(`incoming channel ${channel.channelId} has no previous hop`);
    const peer = await options.swarm.connectToPeer(previousHop.publicKeyDigest, channel.channelId);
    await peer.sendMessage({
      type: 'STATE_UPDATE',
      channelId: channel.channelId,
      nonce: link.backwardNonce ?? Date.now(),
      payload: createBackwardPayload(channel, link.preimage ?? ''),
    });
  };

  const revealPreimage = async (hashlock: string, preimage: string): Promise<RevealPreimageResult> => {
    const link = links.get(hashlock) ?? await options.linkJournal.get(hashlock);
    if (!link) return { status: 'unknown' };
    const channel = options.channels.get(link.inChannelId);
    if (!channel) return { status: 'unknown' };

    // OMN-006: record the preimage and the backward duty BEFORE changing signed
    // state. A crash between fulfil and send must leave recovery something to
    // replay, not a cleared link.
    const pending: HtlcLink = {
      ...link,
      preimage,
      status: 'preimage-revealed',
      backwardNonce: link.backwardNonce ?? Date.now(),
    };
    links.set(hashlock, pending);
    await options.linkJournal.record(pending);

    const result = await fulfillHTLC(channel, link.inHtlcId, preimage, options.leaseProvider, options.chainProvider, options.signer);
    options.channels.set(result.channel.channelId, result.channel);

    // Propagate the fulfilment (and the preimage) to the previous hop so the
    // backward settlement walk can continue to the payer.
    try {
      await sendBackward(pending);
      const sent: HtlcLink = { ...pending, status: 'backward-sent' };
      links.set(hashlock, sent);
      await options.linkJournal.record(sent);
    } catch {
      // Keep `preimage-revealed`: recover() will retry the same nonce.
      return { status: 'settled', inChannelId: link.inChannelId };
    }

    options.onSettled?.({ hashlock, inChannelId: link.inChannelId, inHtlcId: link.inHtlcId });
    return { status: 'settled', inChannelId: link.inChannelId };
  };

  const recover = async (): Promise<HtlcLink[]> => {
    const journaled: HtlcLink[] = typeof options.linkJournal.list === 'function'
      ? await options.linkJournal.list()
      : [...links.values()];
    const unresolved: HtlcLink[] = [];
    for (const link of journaled) {
      const inChannel = options.channels.get(link.inChannelId);
      const inHtlc = inChannel?.pendingHTLCs.find((h) => h.htlcId === link.inHtlcId);
      // CAN-009: only the INCOMING side decides whether the association is still
      // needed. An outgoing HTLC being fulfilled means "reveal the preimage to
      // the incoming side", not "settled backwards".
      const inTerminal = !inHtlc || inHtlc.status !== 'pending';

      // OMN-006: a preimage was journaled (final hop or reveal) but the incoming
      // HTLC is still pending — finish the fulfilment locally first.
      if (!inTerminal && link.preimage && link.status === 'preimage-revealed' && inChannel && inHtlc) {
        try {
          const fulfilled = await fulfillHTLC(
            inChannel,
            link.inHtlcId,
            link.preimage,
            options.leaseProvider,
            options.chainProvider,
            options.signer,
          );
          options.channels.set(fulfilled.channel.channelId, fulfilled.channel);
          try {
            await sendBackward(link);
            const sent: HtlcLink = { ...link, status: 'backward-sent' };
            links.set(link.hashlock, sent);
            await options.linkJournal.record(sent);
            unresolved.push(sent);
          } catch {
            unresolved.push(link);
          }
        } catch {
          unresolved.push(link);
        }
        continue;
      }

      // OMN-006: the incoming HTLC being terminal does not mean the backward
      // preimage reached the previous hop. Retry until it is sent, then clear
      // on the next recovery pass.
      if (inTerminal && link.preimage && link.status !== 'backward-sent') {
        try {
          await sendBackward(link);
          const sent: HtlcLink = { ...link, status: 'backward-sent' };
          links.set(link.hashlock, sent);
          await options.linkJournal.record(sent);
          unresolved.push(sent);
        } catch {
          unresolved.push(link);
        }
        continue;
      }
      if (inTerminal) {
        links.delete(link.hashlock);
        await options.linkJournal.remove(link.hashlock);
        continue;
      }

      // CAN-008: an intent whose outgoing HTLC id was never journaled. If the
      // signed HTLC exists on the outgoing channel, complete the link;
      // otherwise the forward died before anything was signed and the intent is
      // safe to drop.
      if (link.status === 'intent' || !link.outHtlcId) {
        const outChannel = options.channels.get(link.outChannelId);
        const match = outChannel?.pendingHTLCs.find(
          (h) => h.hashlock === link.hashlock && h.status === 'pending',
        );
        if (!match) {
          links.delete(link.hashlock);
          await options.linkJournal.remove(link.hashlock);
          continue;
        }
        const completed: HtlcLink = {
          ...link,
          outChannelId: outChannel!.channelId,
          outHtlcId: match.htlcId,
          status: 'active',
        };
        links.set(completed.hashlock, completed);
        await options.linkJournal.record(completed);
        unresolved.push(completed);
        continue;
      }

      unresolved.push(link);
    }
    return unresolved;
  };

  return { forwardIncoming, revealPreimage, recover, links: () => links };
}
