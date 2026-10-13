/**
 * Splice peer round-trip (RFC-035 B1).
 *
 * Two-party splice over the coordination transport:
 *
 *   proposer ── SPLICE_PROPOSAL ─▶ acceptor
 *   proposer ◀─ SPLICE_ACCEPT   ── acceptor   (acceptor reserves a WOTS leaf)
 *   proposer ── SPLICE_FINALIZED ─▶ acceptor  (acceptor commits its leaf)
 *
 * Verify-before-sign: the acceptor cryptographically verifies the proposer's
 * signature over the splice digest (and `acceptSplice` binds the draft to the
 * local channel) before it signs. Each party commits/burns its **own** lease:
 * the proposer on `finalizeSplice`, the acceptor on `SPLICE_FINALIZED` (or burns
 * it when no confirmation arrives within the TTL).
 */

import { verifyChannelSignature } from '@totemsdk/omnia';
import type {
  OmniaChannel,
  OmniaPeer,
  OmniaCoordination,
  CoordinationContext,
  CoordinationHandlers,
} from '@totemsdk/omnia';
import type {
  SpliceProposal,
  SpliceAcceptance,
  SpliceLeaseProvider,
  SpliceParams,
  QuiescedChannel,
  SplicedChannel,
} from './types.js';
import { proposeSpliceIn, proposeSpliceOut, acceptSplice } from './splice.js';
import { finalizeSplice, type FinalizeSpliceOptions } from './finalize.js';
import { quiesceChannel } from './quiesce.js';
import { computeSpliceTxDigest } from './splice-tx.js';

export type VerifySignature = (signature: Uint8Array, digest: Uint8Array, publicKeyDigest: string) => boolean;
export type ChannelStore = Map<string, OmniaChannel | QuiescedChannel>;

export interface SpliceApprovalRequest {
  channelId: string;
  spliceId: string;
  proposer: string;
  params: SpliceParams;
}
export type SpliceApproval = (request: SpliceApprovalRequest) => Promise<boolean>;

export interface SpliceCoordinationDeps {
  /** This peer's known channels (its own quiesced copies). */
  channels: ChannelStore;
  /** This peer's signer + WOTS lease provider. */
  leaseProvider: SpliceLeaseProvider;
  /** Signature verifier; defaults to `verifyChannelSignature` (RFC-037). */
  verifySignature?: VerifySignature;
  /** Extra finalize options (broadcast, mineDifficulty). */
  finalizeOptions?: FinalizeSpliceOptions;
  /** Consent gate for signing an acceptance (RFC-014 §6.3). */
  approval?: SpliceApproval;
  /** Called on the proposer when the splice finalizes. */
  onFinalized?: (channel: SplicedChannel, peer: OmniaPeer) => void;
  /** Acceptor reservation TTL before burn (default 24h). */
  ttlMs?: number;
}

export interface SpliceProposeParams {
  type: 'in' | 'out';
  additionalCoinId?: string;
  additionalAmount?: bigint;
  withdrawAmount?: bigint;
  withdrawAddress?: string;
}

export interface SpliceCoordination {
  handlers: CoordinationHandlers;
  propose(
    peer: OmniaPeer,
    coordination: OmniaCoordination,
    channel: OmniaChannel | QuiescedChannel,
    params: SpliceProposeParams,
  ): Promise<SpliceProposal>;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

async function ensureQuiesced(
  channel: OmniaChannel | QuiescedChannel,
  leaseProvider: SpliceLeaseProvider,
): Promise<QuiescedChannel> {
  return channel.status === 'quiesced'
    ? (channel as QuiescedChannel)
    : quiesceChannel(channel as OmniaChannel, leaseProvider);
}

export function createSpliceCoordination(deps: SpliceCoordinationDeps): SpliceCoordination {
  const { channels, leaseProvider, approval, onFinalized } = deps;
  const verify: VerifySignature =
    deps.verifySignature ?? ((sig, digest, pkd) => verifyChannelSignature(sig, digest, pkd));
  const finalizeOptions: FinalizeSpliceOptions = {
    ...deps.finalizeOptions,
    verifySignature: deps.finalizeOptions?.verifySignature ?? verify,
  };
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;

  // Acceptor-side reservations awaiting confirmation (commit) or TTL (burn).
  const pendingAcceptances = new Map<string, SpliceAcceptance>();
  const burnTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const burnPending = (spliceId: string, reason: string): void => {
    const pending = pendingAcceptances.get(spliceId);
    if (!pending) return;
    pendingAcceptances.delete(spliceId);
    const timer = burnTimers.get(spliceId);
    if (timer) {
      clearTimeout(timer);
      burnTimers.delete(spliceId);
    }
    void leaseProvider.wotsLease.burnReservation(pending.acceptorReservationId, reason).catch(() => {});
  };

  const handleProposal = async (ctx: CoordinationContext): Promise<void> => {
    const proposal = ctx.message.payload as SpliceProposal;
    const channel = channels.get(proposal.channelId);
    if (!channel) throw new Error(`splice proposal for unknown channel ${proposal.channelId}`);

    // Verify the proposer's signature BEFORE producing ours (RFC-035 §6.5.2).
    const digest = computeSpliceTxDigest(proposal.spliceTxDraft);
    if (!verify(proposal.proposerSignature, digest, proposal.proposerPublicKeyDigest)) {
      throw new Error('splice proposal: proposer signature failed verification');
    }

    if (!ctx.policy.autoAccept) {
      const approved = approval
        ? await approval({
            channelId: proposal.channelId,
            spliceId: proposal.spliceId,
            proposer: proposal.proposerPublicKeyDigest,
            params: proposal.params,
          })
        : false;
      if (!approved) throw new Error('splice acceptance rejected: approval required');
    }

    // acceptSplice binds the draft to our channel + validates params, then signs.
    const local = await ensureQuiesced(channel, leaseProvider);
    channels.set(local.channelId, local);
    const acceptance = await acceptSplice(local, proposal, leaseProvider);

    pendingAcceptances.set(proposal.spliceId, acceptance);
    burnTimers.set(
      proposal.spliceId,
      setTimeout(() => burnPending(proposal.spliceId, 'splice-finalize-timeout'), ttlMs),
    );

    await ctx.send('SPLICE_ACCEPT', acceptance);
  };

  const handleAccept = async (ctx: CoordinationContext): Promise<void> => {
    const acceptance = ctx.message.payload as SpliceAcceptance;
    const record = await ctx.store.getProposal(ctx.correlationId);
    if (!record) throw new Error(`no stored splice proposal for ${ctx.correlationId}`);
    const proposal = record.payload as SpliceProposal;

    const channel = channels.get(proposal.channelId);
    if (!channel) throw new Error(`splice acceptance for unknown channel ${proposal.channelId}`);

    // finalizeSplice verifies both signatures + draft binding, then commits the
    // proposer's OWN reservation.
    const spliced = await finalizeSplice(channel, proposal, acceptance, {
      ...finalizeOptions,
      proposerLeaseProvider: leaseProvider.wotsLease,
    });
    channels.set(spliced.channelId, spliced);
    await ctx.store.setProposalState(ctx.correlationId, 'committed');
    onFinalized?.(spliced, ctx.peer);
    await ctx.send('SPLICE_FINALIZED', { spliceId: proposal.spliceId });
  };

  const handleFinalized = async (ctx: CoordinationContext): Promise<void> => {
    const spliceId = (ctx.message.payload as { spliceId?: string })?.spliceId ?? ctx.correlationId;
    const pending = pendingAcceptances.get(spliceId);
    if (!pending) return;
    pendingAcceptances.delete(spliceId);
    const timer = burnTimers.get(spliceId);
    if (timer) {
      clearTimeout(timer);
      burnTimers.delete(spliceId);
    }
    await leaseProvider.wotsLease.commitKeyUse(pending.acceptorReservationId, `splice-finalized:${spliceId}`);
  };

  const handlers: CoordinationHandlers = {
    SPLICE_PROPOSAL: handleProposal,
    SPLICE_ACCEPT: handleAccept,
    SPLICE_FINALIZED: handleFinalized,
  };

  const propose = async (
    peer: OmniaPeer,
    coordination: OmniaCoordination,
    channel: OmniaChannel | QuiescedChannel,
    params: SpliceProposeParams,
  ): Promise<SpliceProposal> => {
    const local = await ensureQuiesced(channel, leaseProvider);
    channels.set(local.channelId, local);
    const proposal =
      params.type === 'in'
        ? await proposeSpliceIn(local, params.additionalCoinId!, params.additionalAmount!, leaseProvider)
        : await proposeSpliceOut(local, params.withdrawAmount!, params.withdrawAddress!, leaseProvider);
    await coordination.sendProposal({
      peer,
      kind: 'SPLICE_PROPOSAL',
      correlationId: proposal.spliceId,
      channelId: proposal.channelId,
      payload: proposal,
    });
    return proposal;
  };

  return { handlers, propose };
}
