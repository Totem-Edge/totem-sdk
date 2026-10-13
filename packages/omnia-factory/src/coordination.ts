/**
 * Factory peer round-trips (RFC-035 B2 open, B3 close).
 *
 * Opening:
 *   initiator ── FACTORY_PROPOSAL (opening factory) ─▶ co-signer ×(N-1)
 *   initiator ◀─ FACTORY_ACCEPT (own opening signature) ── co-signer
 *   initiator ── FACTORY_FINALIZED ─▶ all co-signers (commit their held leaf)
 *
 * Closing (cooperative N-of-N settlement):
 *   initiator ── FACTORY_CLOSE_PROPOSAL (settlement draft) ─▶ co-signer ×(N-1)
 *   initiator ◀─ FACTORY_CLOSE_ACCEPT (own settlement signature) ── co-signer
 *   initiator assembles + (optional) mines/broadcasts, then
 *   ── FACTORY_CLOSE_FINALIZED ─▶ all co-signers (commit their held leaf)
 *
 * Each party commits/burns its **own** lease: the initiator on assemble, the
 * co-signers on the `*_FINALIZED` confirmation (burns on TTL).
 */

import { verifyChannelSignature } from '@totemsdk/omnia';
import type {
  OmniaPeer,
  OmniaCoordination,
  CoordinationContext,
  CoordinationHandlers,
} from '@totemsdk/omnia';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type {
  ChannelFactory,
  FactorySettlementPayload,
  OmniaChannel,
  WotsLeaseBundle,
} from './types.js';
import {
  signFactoryOpening,
  verifyFactorySignature,
  applyFactorySignature,
  type FactoryOpeningSignature,
} from './factory.js';
import {
  buildFactorySettlement,
  signFactorySettlement,
  verifyFactorySettlementSignature,
  assembleFactorySettlement,
  type FactorySettlementDraft,
  type FactorySettlementSignature,
} from './settlement.js';
import {
  buildVirtualChannelOpen,
  signVirtualChannelOpen,
  verifyVirtualChannelOpenSignature,
  assembleVirtualChannelOpen,
  type VirtualChannelOpenPlan,
  type VirtualChannelOpenSignature,
} from './virtual.js';

export type VerifySignature = (
  signature: Uint8Array,
  commitment: Uint8Array,
  publicKeyDigest: string,
) => boolean;

export type FactoryStore = Map<string, ChannelFactory>;

export interface FactoryApprovalRequest {
  factoryId: string;
  proposer: string;
  participants: number;
}
export type FactoryApproval = (request: FactoryApprovalRequest) => Promise<boolean>;

export interface FactoryCoordinationDeps {
  /** This peer's factories (its own copies). */
  factories: FactoryStore;
  /** This peer's signing bundle. */
  bundle: WotsLeaseBundle;
  verifySignature?: VerifySignature;
  approval?: FactoryApproval;
  onOpened?: (factory: ChannelFactory, peer: OmniaPeer) => void;
  onClosed?: (payload: FactorySettlementPayload, peer: OmniaPeer) => void;
  onVcOpened?: (factory: ChannelFactory, channel: OmniaChannel, peer: OmniaPeer) => void;
  /** Initiator-only: mine + broadcast the settlement TxPoW. */
  chainProvider?: ChainStateProvider;
  ttlMs?: number;
}

export interface FactoryCoordination {
  handlers: CoordinationHandlers;
  /** Send a FACTORY_PROPOSAL for an 'opening' factory. */
  openFactory(peer: OmniaPeer, coordination: OmniaCoordination, factory: ChannelFactory): Promise<void>;
  /** Send a FACTORY_CLOSE_PROPOSAL and gather N-of-N settlement signatures. */
  closeFactory(peer: OmniaPeer, coordination: OmniaCoordination, factory: ChannelFactory): Promise<void>;
  /** Send a VC_PROPOSAL and gather N-of-N virtual-channel-open signatures. */
  openVirtualChannel(
    peer: OmniaPeer,
    coordination: OmniaCoordination,
    factory: ChannelFactory,
    parties: [string, string],
    amounts: Record<string, bigint>,
  ): Promise<void>;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function createFactoryCoordination(deps: FactoryCoordinationDeps): FactoryCoordination {
  const { factories, bundle, approval, onOpened, onClosed, onVcOpened, chainProvider } = deps;
  const verify: VerifySignature =
    deps.verifySignature ?? ((sig, commitment, pkd) => verifyChannelSignature(sig, commitment, pkd));
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;

  const pendingOpenings = new Map<string, FactoryOpeningSignature>();
  const pendingSettlements = new Map<string, FactorySettlementSignature>();
  const pendingVcOpenings = new Map<string, VirtualChannelOpenSignature>();
  const burnTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const factoryPeers = new Map<string, Set<OmniaPeer>>();

  // Initiator-side close state.
  const closeDrafts = new Map<string, FactorySettlementDraft>();
  const closeSignatures = new Map<string, Record<string, FactorySettlementSignature>>();

  // Initiator-side VC-open state.
  const vcPlans = new Map<string, VirtualChannelOpenPlan>();
  const vcSignatures = new Map<string, Record<string, VirtualChannelOpenSignature>>();

  const scheduleBurn = (factoryId: string, reservationId: string, reason: string): void => {
    burnTimers.set(
      factoryId,
      setTimeout(() => {
        const had =
          pendingOpenings.has(factoryId) ||
          pendingSettlements.has(factoryId) ||
          pendingVcOpenings.has(factoryId);
        if (!had) return;
        pendingOpenings.delete(factoryId);
        pendingSettlements.delete(factoryId);
        pendingVcOpenings.delete(factoryId);
        burnTimers.delete(factoryId);
        void bundle.leaseProvider.burnReservation(reservationId, reason).catch(() => {});
      }, ttlMs),
    );
  };

  const registerPeer = (factoryId: string, peer: OmniaPeer): void => {
    const set = factoryPeers.get(factoryId) ?? new Set<OmniaPeer>();
    set.add(peer);
    factoryPeers.set(factoryId, set);
  };

  const fanOut = async (ctx: CoordinationContext, factoryId: string, type: 'FACTORY_FINALIZED' | 'FACTORY_CLOSE_FINALIZED' | 'VC_FINALIZED'): Promise<void> => {
    const peers = factoryPeers.get(factoryId);
    if (!peers) return;
    for (const peer of peers) {
      await ctx.sendTo(peer, type, { factoryId }).catch(() => {});
    }
  };

  // ── Opening ────────────────────────────────────────────────────────────────

  const handleProposal = async (ctx: CoordinationContext): Promise<void> => {
    const factory = ctx.message.payload as ChannelFactory;
    if (!factory || factory.status !== 'opening' || !factory.pendingCommitment) {
      throw new Error('factory proposal must be an opening factory');
    }
    if (!factory.participants.find((p) => p.publicKeyDigest === bundle.signer.publicKeyDigest)) {
      throw new Error('local signer is not a factory participant');
    }
    for (const [partyId, sig] of Object.entries(factory.pendingSignatures ?? {})) {
      if (!verifyFactorySignature(factory, partyId, sig as Uint8Array, verify)) {
        throw new Error(`factory proposal: invalid signature for '${partyId}'`);
      }
    }
    if (!ctx.policy.autoAccept) {
      const approved = approval
        ? await approval({ factoryId: factory.factoryId, proposer: Object.keys(factory.pendingSignatures ?? {})[0] ?? '', participants: factory.participants.length })
        : false;
      if (!approved) throw new Error('factory opening rejected: approval required');
    }

    const opening = await signFactoryOpening(factory, bundle);
    pendingOpenings.set(factory.factoryId, opening);
    scheduleBurn(factory.factoryId, opening.reservationId, 'factory-open-timeout');

    await ctx.send('FACTORY_ACCEPT', {
      factoryId: factory.factoryId,
      partyId: opening.partyId,
      signature: opening.signature,
    });
  };

  const handleAccept = async (ctx: CoordinationContext): Promise<void> => {
    const { factoryId, partyId, signature } = ctx.message.payload as {
      factoryId: string;
      partyId: string;
      signature: Uint8Array;
    };
    const factory = factories.get(factoryId);
    if (!factory) throw new Error(`factory accept for unknown factory ${factoryId}`);
    if (!verifyFactorySignature(factory, partyId, signature, verify)) {
      throw new Error(`factory accept: invalid signature from '${partyId}'`);
    }
    const updated = applyFactorySignature(factory, partyId, signature);
    factories.set(factoryId, updated);
    if (updated.status === 'active') {
      onOpened?.(updated, ctx.peer);
      await fanOut(ctx, factoryId, 'FACTORY_FINALIZED');
    }
  };

  const handleFinalized = async (ctx: CoordinationContext): Promise<void> => {
    const factoryId = (ctx.message.payload as { factoryId?: string })?.factoryId ?? ctx.correlationId;
    const pending = pendingOpenings.get(factoryId);
    if (!pending) return;
    pendingOpenings.delete(factoryId);
    const timer = burnTimers.get(factoryId);
    if (timer) {
      clearTimeout(timer);
      burnTimers.delete(factoryId);
    }
    await bundle.leaseProvider.commitKeyUse(pending.reservationId, `factory-finalized:${factoryId}`);
  };

  // ── Closing ────────────────────────────────────────────────────────────────

  const handleCloseProposal = async (ctx: CoordinationContext): Promise<void> => {
    const { factoryId, draft } = ctx.message.payload as {
      factoryId: string;
      draft: FactorySettlementDraft;
    };
    const factory = factories.get(factoryId);
    if (!factory) throw new Error(`factory close proposal for unknown factory ${factoryId}`);
    if (!factory.participants.find((p) => p.publicKeyDigest === bundle.signer.publicKeyDigest)) {
      throw new Error('local signer is not a factory participant');
    }

    // Bind the proposal to our own view: rebuild and compare.
    const local = buildFactorySettlement(factory);
    if (toHex(local.txDigest) !== toHex(draft.txDigest) || local.settlementTxHex !== draft.settlementTxHex) {
      throw new Error('factory close proposal: settlement draft does not match local factory state');
    }

    if (!ctx.policy.autoAccept) {
      const approved = approval
        ? await approval({ factoryId, proposer: '', participants: factory.participants.length })
        : false;
      if (!approved) throw new Error('factory close rejected: approval required');
    }

    const sig = await signFactorySettlement(factory, local, bundle);
    pendingSettlements.set(factoryId, sig);
    scheduleBurn(factoryId, sig.reservationId, 'factory-close-timeout');

    await ctx.send('FACTORY_CLOSE_ACCEPT', {
      factoryId,
      partyId: sig.partyId,
      signature: sig.signature,
    });
  };

  const handleCloseAccept = async (ctx: CoordinationContext): Promise<void> => {
    const { factoryId, partyId, signature } = ctx.message.payload as {
      factoryId: string;
      partyId: string;
      signature: Uint8Array;
    };
    const factory = factories.get(factoryId);
    if (!factory) throw new Error(`factory close accept for unknown factory ${factoryId}`);
    const draft = closeDrafts.get(factoryId);
    if (!draft) throw new Error(`no settlement draft for factory ${factoryId}`);
    if (!verifyFactorySettlementSignature(factory, draft.txDigest, partyId, signature, verify)) {
      throw new Error(`factory close accept: invalid signature from '${partyId}'`);
    }

    const sigs = closeSignatures.get(factoryId) ?? {};
    sigs[partyId] = { partyId, signature, reservationId: '' };
    closeSignatures.set(factoryId, sigs);

    if (factory.participants.every((p) => sigs[p.partyId])) {
      const payload = await assembleFactorySettlement(factory, draft, sigs, chainProvider, { verify });
      // commit the initiator's OWN held reservation (the only one with an id)
      const own = Object.values(sigs).find((s) => s.reservationId);
      if (own?.reservationId) {
        await bundle.leaseProvider.commitKeyUse(own.reservationId, `factory-settled:${factoryId}`);
      }
      onClosed?.(payload, ctx.peer);
      await fanOut(ctx, factoryId, 'FACTORY_CLOSE_FINALIZED');
    }
  };

  const handleCloseFinalized = async (ctx: CoordinationContext): Promise<void> => {
    const factoryId = (ctx.message.payload as { factoryId?: string })?.factoryId ?? ctx.correlationId;
    const pending = pendingSettlements.get(factoryId);
    if (!pending) return;
    pendingSettlements.delete(factoryId);
    const timer = burnTimers.get(factoryId);
    if (timer) {
      clearTimeout(timer);
      burnTimers.delete(factoryId);
    }
    await bundle.leaseProvider.commitKeyUse(pending.reservationId, `factory-settled:${factoryId}`);
  };

  // ── Virtual channel open ─────────────────────────────────────────────────────

  const handleVcProposal = async (ctx: CoordinationContext): Promise<void> => {
    const { factoryId, plan } = ctx.message.payload as { factoryId: string; plan: VirtualChannelOpenPlan };
    const factory = factories.get(factoryId);
    if (!factory) throw new Error(`vc proposal for unknown factory ${factoryId}`);
    if (!factory.participants.find((p) => p.publicKeyDigest === bundle.signer.publicKeyDigest)) {
      throw new Error('local signer is not a factory participant');
    }
    const local = buildVirtualChannelOpen(factory, plan.parties, plan.amounts, plan.vcId);
    if (toHex(local.commitment) !== toHex(plan.commitment)) {
      throw new Error('vc proposal: commitment does not match local factory state');
    }
    if (!ctx.policy.autoAccept) {
      const approved = approval
        ? await approval({ factoryId, proposer: '', participants: factory.participants.length })
        : false;
      if (!approved) throw new Error('virtual channel open rejected: approval required');
    }

    const sig = await signVirtualChannelOpen(factory, local, bundle);
    pendingVcOpenings.set(plan.vcId, sig);
    scheduleBurn(plan.vcId, sig.reservationId, 'vc-open-timeout');
    await ctx.send('VC_ACCEPT', { factoryId, partyId: sig.partyId, signature: sig.signature });
  };

  const handleVcAccept = async (ctx: CoordinationContext): Promise<void> => {
    const { factoryId, partyId, signature } = ctx.message.payload as {
      factoryId: string;
      partyId: string;
      signature: Uint8Array;
    };
    const factory = factories.get(factoryId);
    if (!factory) throw new Error(`vc accept for unknown factory ${factoryId}`);
    const plan = vcPlans.get(ctx.correlationId);
    if (!plan) throw new Error(`no VC plan for ${ctx.correlationId}`);
    if (!verifyVirtualChannelOpenSignature(factory, plan.commitment, partyId, signature, verify)) {
      throw new Error(`vc accept: invalid signature from '${partyId}'`);
    }

    const sigs = vcSignatures.get(ctx.correlationId) ?? {};
    sigs[partyId] = { partyId, signature, reservationId: '' };
    vcSignatures.set(ctx.correlationId, sigs);

    if (factory.participants.every((p) => sigs[p.partyId])) {
      const { factory: updated, channel } = assembleVirtualChannelOpen(factory, plan, sigs, verify);
      factories.set(factoryId, updated);
      const own = Object.values(sigs).find((s) => s.reservationId);
      if (own?.reservationId) {
        await bundle.leaseProvider.commitKeyUse(own.reservationId, `vc-opened:${plan.vcId}`);
      }
      onVcOpened?.(updated, channel, ctx.peer);
      await fanOut(ctx, factoryId, 'VC_FINALIZED');
    }
  };

  const handleVcFinalized = async (ctx: CoordinationContext): Promise<void> => {
    const vcId = ctx.correlationId;
    const pending = pendingVcOpenings.get(vcId);
    if (!pending) return;
    pendingVcOpenings.delete(vcId);
    const timer = burnTimers.get(vcId);
    if (timer) {
      clearTimeout(timer);
      burnTimers.delete(vcId);
    }
    await bundle.leaseProvider.commitKeyUse(pending.reservationId, `vc-opened:${vcId}`);
  };

  const handlers: CoordinationHandlers = {
    FACTORY_PROPOSAL: handleProposal,
    FACTORY_ACCEPT: handleAccept,
    FACTORY_FINALIZED: handleFinalized,
    FACTORY_CLOSE_PROPOSAL: handleCloseProposal,
    FACTORY_CLOSE_ACCEPT: handleCloseAccept,
    FACTORY_CLOSE_FINALIZED: handleCloseFinalized,
    VC_PROPOSAL: handleVcProposal,
    VC_ACCEPT: handleVcAccept,
    VC_FINALIZED: handleVcFinalized,
  };

  const openFactory = async (peer: OmniaPeer, coordination: OmniaCoordination, factory: ChannelFactory): Promise<void> => {
    if (factory.status !== 'opening') throw new Error('openFactory requires an opening factory');
    factories.set(factory.factoryId, factory);
    registerPeer(factory.factoryId, peer);
    await coordination.sendProposal({
      peer,
      kind: 'FACTORY_PROPOSAL',
      correlationId: factory.factoryId,
      channelId: factory.factoryId,
      payload: factory,
    });
  };

  const closeFactory = async (peer: OmniaPeer, coordination: OmniaCoordination, factory: ChannelFactory): Promise<void> => {
    if (factory.status !== 'active') throw new Error('closeFactory requires an active factory');
    factories.set(factory.factoryId, factory);
    registerPeer(factory.factoryId, peer);

    const draft = buildFactorySettlement(factory);
    const own = await signFactorySettlement(factory, draft, bundle);
    closeDrafts.set(factory.factoryId, draft);
    closeSignatures.set(factory.factoryId, { [own.partyId]: own });

    await coordination.sendProposal({
      peer,
      kind: 'FACTORY_CLOSE_PROPOSAL',
      correlationId: factory.factoryId,
      channelId: factory.factoryId,
      payload: { factoryId: factory.factoryId, draft },
    });
  };

  const openVirtualChannel = async (
    peer: OmniaPeer,
    coordination: OmniaCoordination,
    factory: ChannelFactory,
    parties: [string, string],
    amounts: Record<string, bigint>,
  ): Promise<void> => {
    if (factory.status !== 'active') throw new Error('openVirtualChannel requires an active factory');
    factories.set(factory.factoryId, factory);
    registerPeer(factory.factoryId, peer);

    const plan = buildVirtualChannelOpen(factory, parties, amounts);
    const own = await signVirtualChannelOpen(factory, plan, bundle);
    vcPlans.set(plan.vcId, plan);
    vcSignatures.set(plan.vcId, { [own.partyId]: own });

    await coordination.sendProposal({
      peer,
      kind: 'VC_PROPOSAL',
      correlationId: plan.vcId,
      channelId: factory.factoryId,
      payload: { factoryId: factory.factoryId, plan },
    });
  };

  return { handlers, openFactory, closeFactory, openVirtualChannel };
}
