/**
 * @module @totemsdk/omnia-relay
 *
 * Wallet-side Omnia client. Composes the browser-safe relay transport from
 * `@totemsdk/omnia/relay` with routing (`@totemsdk/omnia-router`) and the
 * single-party factory/splice halves (`@totemsdk/omnia-factory`,
 * `@totemsdk/omnia-splice`). Assign `createOmniaRelayClient()` as the wallet's
 * `omnia` port.
 */

// Re-export the browser-safe base relay client + transport primitives.
export {
  AXIA_RELAY_URL,
  relaySwarmUrl,
  createRelayOmniaSwarm,
  createRelayOmniaOperations,
  createRelayOmniaClient,
  ADVANCED_UNSUPPORTED,
  MUTATION_METHODS,
} from '@totemsdk/omnia/relay';
export type {
  RelayOmniaSwarmOptions,
  RelayOmniaOperations,
  RelayOmniaOperationsOptions,
  RelayOmniaClient,
  RelayOmniaClientOptions,
} from '@totemsdk/omnia/relay';

// Composed wallet client (Phase A).
export { createOmniaRelayClient, fulfillMultiHop } from './client.js';
export type { OmniaRelayClientOptions } from './client.js';

// Multi-hop HTLC forwarder (RFC-035 B4, intermediary role).
export { createMultiHopForwarder } from './forwarder.js';
export type {
  MultiHopForwarder,
  MultiHopForwarderOptions,
  ForwardIncomingParams,
  ForwardIncomingResult,
  RevealPreimageResult,
  HtlcLink,
} from './forwarder.js';

// Routing seam + helpers.
export {
  channelGraphEdges,
  createChannelRoutingPort,
  buildGraph,
  queryRoute,
  serializeRoute,
  serializeSwapAnnouncement,
  getSwapAnnouncements,
} from './routing.js';
export type { RoutingPort, RouteQuery } from './routing.js';

// Wallet channel-signing bridge (RFC-037 Phase 2).
export { createWalletChannelSigningMaterial, KEYS_PER_LEVEL } from './signer.js';export type {
  WalletChannelSigningMaterial,
  WalletChannelSigningOptions,
} from './signer.js';

// Channel participant identity verification (RFC-037 Amendment A).
export {
  verifyChannelParticipantIdentity,
  WALLET_IDENTITY_KIND,
} from './identity.js';
export type { IdentityVerificationResult } from './identity.js';

// Wallet coordination composition (RFC-035 B5).
export { createWalletCoordination } from './coordination.js';
export type {
  WalletCoordination,
  WalletCoordinationOptions,
  WalletApproval,
  WalletApprovalRequest,
  WalletApprovalKind,
} from './coordination.js';

// Host-facing re-exports (so a wallet only depends on @totemsdk/omnia-relay).
export { createStorageCoordinationStore, createMemoryCoordinationStore } from '@totemsdk/omnia';
export type { OmniaChannel } from '@totemsdk/omnia';
export type { ChannelFactory } from '@totemsdk/omnia-factory';
export type { QuiescedChannel, SplicedChannel } from '@totemsdk/omnia-splice';
