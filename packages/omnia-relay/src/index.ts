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
export { createOmniaRelayClient } from './client.js';
export type { OmniaRelayClientOptions } from './client.js';

// Routing seam + helpers.
export {
  channelGraphEdges,
  buildGraph,
  queryRoute,
  serializeRoute,
  serializeSwapAnnouncement,
  getSwapAnnouncements,
} from './routing.js';
export type { RoutingPort, RouteQuery } from './routing.js';
