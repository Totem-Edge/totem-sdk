/**
 * Wallet coordination composition (RFC-035 B5).
 *
 * Wires the RFC-035 coordination transport to the wallet's signing material and
 * the splice/factory handlers, so a host (extension/PWA) only supplies a durable
 * store, an approval port, and the peer swarm. It is the single entry point that
 * makes the landed B1–B4 round-trips reachable end-to-end.
 *
 *   const coord = createWalletCoordination({ channels, factories, signer,
 *     leaseProvider, store, approval, chainProvider });
 *   swarm.listenForChannels((peer) => coord.bindPeer(peer));
 *   // initiate: coord.splice.propose(peer, coord.coordination, channel, params)
 */

import {
  createOmniaCoordination,
  type OmniaCoordination,
  type CoordinationStore,
  type CoordinationPolicy,
  type OmniaPeer,
  type OmniaChannel,
  type ChannelSigner,
  type CustodyContext,
} from '@totemsdk/omnia';
import {
  createSpliceCoordination,
  type SpliceCoordination,
  type SpliceLeaseProvider,
  type QuiescedChannel,
  type SplicedChannel,
} from '@totemsdk/omnia-splice';
import {
  createFactoryCoordination,
  type FactoryCoordination,
  type WotsLeaseBundle,
  type ChannelFactory,
  type FactorySettlementPayload,
} from '@totemsdk/omnia-factory';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';

export type WalletApprovalKind = 'splice-accept' | 'factory-open' | 'factory-close' | 'vc-open';

export interface WalletApprovalRequest {
  kind: WalletApprovalKind;
  channelId?: string;
  factoryId?: string;
  spliceId?: string;
  proposer?: string;
  /** RFC-058 custody/disclosure metadata; hosted requests must be gated. */
  custody?: CustodyContext;
}
export type WalletApproval = (request: WalletApprovalRequest) => Promise<boolean>;

export interface WalletCoordinationOptions {
  /** This wallet's known channels (incl. quiesced). */
  channels: Map<string, OmniaChannel | QuiescedChannel>;
  /** This wallet's known factories (opening/active). */
  factories: Map<string, ChannelFactory>;
  signer: ChannelSigner;
  leaseProvider: WotsLeaseProvider;
  /** Durable proposal/acceptance store (RFC-007 storage adapter). */
  store: CoordinationStore;
  /** Consent gate for every signature-producing accept. */
  approval?: WalletApproval;
  /** Inititator-only: mine + broadcast settlement TxPoW. */
  chainProvider?: ChainStateProvider;
  policy?: CoordinationPolicy;
  /** RFC-058 custody metadata attached to every approval request. */
  custody?: CustodyContext;
  /** Signature verifier; defaults to `verifyChannelSignature` (RFC-037). */
  verifySignature?: (signature: Uint8Array, digest: Uint8Array, publicKeyDigest: string) => boolean;
  /** Splice finalize options (broadcast / mineDifficulty). */
  spliceFinalizeOptions?: import('@totemsdk/omnia-splice').FinalizeSpliceOptions;
  onSpliceFinalized?: (channel: SplicedChannel, peer: OmniaPeer) => void;
  onFactoryOpened?: (factory: ChannelFactory, peer: OmniaPeer) => void;
  onFactoryClosed?: (payload: FactorySettlementPayload, peer: OmniaPeer) => void;
  onVirtualChannelOpened?: (factory: ChannelFactory, channel: OmniaChannel, peer: OmniaPeer) => void;
}

export interface WalletCoordination {
  coordination: OmniaCoordination;
  splice: SpliceCoordination;
  factory: FactoryCoordination;
  /** Bind an inbound peer's messages to the coordination handlers. */
  bindPeer(peer: OmniaPeer): () => void;
}

export function createWalletCoordination(options: WalletCoordinationOptions): WalletCoordination {
  const factoryBundle: WotsLeaseBundle = {
    signer: options.signer,
    leaseProvider: options.leaseProvider,
  };
  const spliceLease: SpliceLeaseProvider = {
    signer: options.signer,
    wotsLease: options.leaseProvider,
  };

  const approval = options.approval;

  const splice = createSpliceCoordination({
    channels: options.channels,
    leaseProvider: spliceLease,
    verifySignature: options.verifySignature,
    finalizeOptions: options.spliceFinalizeOptions,
    approval: approval
      ? (req) =>
          approval({ kind: 'splice-accept', channelId: req.channelId, spliceId: req.spliceId, proposer: req.proposer, custody: options.custody })
      : undefined,
    onFinalized: options.onSpliceFinalized,
  });

  const factory = createFactoryCoordination({
    factories: options.factories,
    bundle: factoryBundle,
    verifySignature: options.verifySignature,
    chainProvider: options.chainProvider,
    approval: approval
      ? (req) => approval({ kind: 'factory-open', factoryId: req.factoryId, proposer: req.proposer, custody: options.custody })
      : undefined,
    onOpened: options.onFactoryOpened,
    onClosed: options.onFactoryClosed,
    onVcOpened: options.onVirtualChannelOpened,
  });

  const coordination = createOmniaCoordination({
    store: options.store,
    policy: options.policy,
    handlers: { ...splice.handlers, ...factory.handlers },
  });

  return {
    coordination,
    splice,
    factory,
    bindPeer: (peer) => coordination.bindPeer(peer),
  };
}
