/**
 * Factory opening peer round-trip (RFC-035 B2).
 *
 *   initiator ── FACTORY_PROPOSAL (opening factory) ─▶ co-signer ×(N-1)
 *   initiator ◀─ FACTORY_ACCEPT (own opening signature) ── co-signer
 *   initiator ── FACTORY_FINALIZED ─▶ all co-signers (commit their held leaf)
 *
 * The initiator's Phase A `createFactory` already mined/broadcast the funding
 * TxPoW. Co-signers produce their opening signature via `signFactoryOpening`
 * (reserve → sign → verify, NO commit); the lease is committed on
 * `FACTORY_FINALIZED` and burned on the TTL. When all N signatures are gathered
 * the opening commits (`'opening'` → `'active'`).
 */

import { verifyChannelSignature } from '@totemsdk/omnia';
import type {
  OmniaPeer,
  OmniaCoordination,
  CoordinationContext,
  CoordinationHandlers,
} from '@totemsdk/omnia';
import type { ChannelFactory, WotsLeaseBundle } from './types.js';
import {
  signFactoryOpening,
  verifyFactorySignature,
  applyFactorySignature,
  type FactoryOpeningSignature,
} from './factory.js';

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
  /** This peer's factories (its own opening copies). */
  factories: FactoryStore;
  /** This peer's signing bundle. */
  bundle: WotsLeaseBundle;
  verifySignature?: VerifySignature;
  approval?: FactoryApproval;
  onOpened?: (factory: ChannelFactory, peer: OmniaPeer) => void;
  ttlMs?: number;
}

export interface FactoryCoordination {
  handlers: CoordinationHandlers;
  openFactory(peer: OmniaPeer, coordination: OmniaCoordination, factory: ChannelFactory): Promise<void>;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export function createFactoryCoordination(deps: FactoryCoordinationDeps): FactoryCoordination {
  const { factories, bundle, approval, onOpened } = deps;
  const verify: VerifySignature =
    deps.verifySignature ?? ((sig, commitment, pkd) => verifyChannelSignature(sig, commitment, pkd));
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;

  const pendingOpenings = new Map<string, FactoryOpeningSignature>();
  const burnTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const factoryPeers = new Map<string, Set<OmniaPeer>>();

  const handleProposal = async (ctx: CoordinationContext): Promise<void> => {
    const factory = ctx.message.payload as ChannelFactory;
    if (!factory || factory.status !== 'opening' || !factory.pendingCommitment) {
      throw new Error('factory proposal must be an opening factory');
    }
    const ourPkd = bundle.signer.publicKeyDigest;
    if (!factory.participants.find((p) => p.publicKeyDigest === ourPkd)) {
      throw new Error('local signer is not a factory participant');
    }
    // Verify every signature already on the proposal (verify-before-sign).
    for (const [partyId, sig] of Object.entries(factory.pendingSignatures ?? {})) {
      if (!verifyFactorySignature(factory, partyId, sig as Uint8Array, verify)) {
        throw new Error(`factory proposal: invalid signature for '${partyId}'`);
      }
    }

    if (!ctx.policy.autoAccept) {
      const approved = approval
        ? await approval({
            factoryId: factory.factoryId,
            proposer: Object.keys(factory.pendingSignatures ?? {})[0] ?? '',
            participants: factory.participants.length,
          })
        : false;
      if (!approved) throw new Error('factory opening rejected: approval required');
    }

    const opening = await signFactoryOpening(factory, bundle);
    pendingOpenings.set(factory.factoryId, opening);
    burnTimers.set(
      factory.factoryId,
      setTimeout(() => {
        const pending = pendingOpenings.get(factory.factoryId);
        if (!pending) return;
        pendingOpenings.delete(factory.factoryId);
        burnTimers.delete(factory.factoryId);
        void bundle.leaseProvider.burnReservation(pending.reservationId, 'factory-open-timeout').catch(() => {});
      }, ttlMs),
    );

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
      const peers = factoryPeers.get(factoryId);
      if (peers) {
        for (const peer of peers) {
          await ctx.sendTo(peer, 'FACTORY_FINALIZED', { factoryId }).catch(() => {});
        }
      }
    }
  };

  const handleFinalized = async (ctx: CoordinationContext): Promise<void> => {
    const factoryId =
      (ctx.message.payload as { factoryId?: string })?.factoryId ?? ctx.correlationId;
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

  const handlers: CoordinationHandlers = {
    FACTORY_PROPOSAL: handleProposal,
    FACTORY_ACCEPT: handleAccept,
    FACTORY_FINALIZED: handleFinalized,
  };

  const openFactory = async (
    peer: OmniaPeer,
    coordination: OmniaCoordination,
    factory: ChannelFactory,
  ): Promise<void> => {
    if (factory.status !== 'opening') throw new Error('openFactory requires an opening factory');
    factories.set(factory.factoryId, factory);
    const set = factoryPeers.get(factory.factoryId) ?? new Set<OmniaPeer>();
    set.add(peer);
    factoryPeers.set(factory.factoryId, set);
    await coordination.sendProposal({
      peer,
      kind: 'FACTORY_PROPOSAL',
      correlationId: factory.factoryId,
      channelId: factory.factoryId,
      payload: factory,
    });
  };

  return { handlers, openFactory };
}
