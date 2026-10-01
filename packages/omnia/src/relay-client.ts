/**
 * Browser-safe Omnia relay client (RFC-014 §6.3 consent path).
 *
 * The wallets reach the Omnia P2P network through the **Axia DHT relay bridge**
 * by default (`wss://api.axia.to/api/relay/ws`), with an optional **self-hosted
 * relay/sidecar** (`relayUrl`). No Hyperswarm is required — this module imports
 * only `relay.js`/`integration.js`/`channel.js`, never `swarm.js` (which
 * dynamically pulls the native `hyperswarm` dependency). Wallets import it via
 * the `@totemsdk/omnia/relay` subpath so a browser bundle never resolves
 * Hyperswarm.
 *
 * It composes:
 *   - `HostedRelaySwarmImpl` (relay transport),
 *   - `createOmniaIntegration` (inbound CHANNEL_PROPOSAL / STATE_UPDATE /
 *     SETTLEMENT_PROPOSAL handling),
 *   - a channel registry,
 *   - local channel operations (open/pay/settle/close) supplied by the wallet
 *     with its signing material.
 *
 * The local mutation operations require wallet signing material (a
 * `ChannelSigner`, a `WotsLeaseProvider`, a `ChainStateProvider`, and a funding
 * witness signer). When they are not supplied the method returns an explicit
 * `UNSUPPORTED` result — never a silent stub.
 */

import { HostedRelaySwarmImpl } from './relay.js';
import { createOmniaIntegration } from './integration.js';
import type { OmniaSwarm, OmniaSwarmConfig } from './messaging-types.js';
import type { OmniaChannel } from './types.js';

/** Axia-hosted relay bridge (default). */
export const AXIA_RELAY_URL = 'wss://api.axia.to/api/relay/ws';

export interface RelayOmniaSwarmOptions {
  /** Self-hosted relay/sidecar URL. Defaults to {@link AXIA_RELAY_URL}. */
  relayUrl?: string;
  /** Axia API key (hosted mode); appended to the relay URL as `?apiKey=`. */
  apiKey?: string;
  /** Local participant public-key digest, advertised on the relay. */
  localPubkey?: string;
}

/** Resolve the relay WebSocket URL (Axia default, or a self-hosted sidecar). */
export function relaySwarmUrl(options: RelayOmniaSwarmOptions = {}): string {
  const base = options.relayUrl ?? AXIA_RELAY_URL;
  if (!options.apiKey) return base;
  const url = new URL(base);
  url.searchParams.set('apiKey', options.apiKey);
  return url.toString();
}

/** Create a relay-backed Omnia swarm without importing the native Hyperswarm path. */
export function createRelayOmniaSwarm(options: RelayOmniaSwarmOptions = {}): OmniaSwarm {
  const config: OmniaSwarmConfig = options.localPubkey ? { localPubkey: options.localPubkey } : {};
  const swarm = new HostedRelaySwarmImpl(relaySwarmUrl(options), config);
  if (options.localPubkey) swarm.advertise(options.localPubkey);
  return swarm;
}

/** Structural local channel operations supplied by the wallet (signing material). */
export interface RelayOmniaOperations {
  openChannel?(params: Record<string, unknown>): Promise<unknown>;
  pay?(params: Record<string, unknown>): Promise<unknown>;
  settle?(params: Record<string, unknown>): Promise<unknown>;
  closeChannel?(params: Record<string, unknown>): Promise<unknown>;
}

export interface RelayOmniaClientOptions extends RelayOmniaSwarmOptions {
  /** Pre-built swarm (e.g. a host-managed relay connection). Defaults to one built from the relay URL. */
  swarm?: OmniaSwarm;
  /** Channel registry (defaults to a fresh in-memory Map). */
  channels?: Map<string, OmniaChannel>;
  /**
   * Local channel operations. When absent, `openChannel`/`pay`/`settle`/
   * `closeChannel` return an explicit `UNSUPPORTED` result.
   */
  operations?: RelayOmniaOperations;
  /** Wire inbound CHANNEL_PROPOSAL/STATE_UPDATE/SETTLEMENT_PROPOSAL handling. Default true. */
  autoAccept?: boolean;
}

function unsupported(message: string): { success: false; error: string; errorCode: string } {
  return { success: false, error: message, errorCode: 'UNSUPPORTED' };
}

/**
 * The Omnia methods this client does not implement (advanced topology ops). They
 * resolve to an explicit reason so the wallet manifest stays truthful.
 */
const ADVANCED_UNSUPPORTED = new Set([
  'getRoute',
  'getSwapRate',
  'createFactory',
  'openVirtualChannel',
  'closeFactory',
  'spliceIn',
  'spliceOut',
]);

export interface RelayOmniaClient {
  readonly swarm: OmniaSwarm;
  readonly channels: Map<string, OmniaChannel>;
  getChannels(params?: Record<string, unknown>): Promise<unknown>;
  openChannel(params: Record<string, unknown>): Promise<unknown>;
  pay(params: Record<string, unknown>): Promise<unknown>;
  settle(params: Record<string, unknown>): Promise<unknown>;
  closeChannel(params: Record<string, unknown>): Promise<unknown>;
  getRoute(params: Record<string, unknown>): Promise<unknown>;
  getSwapRate(params: Record<string, unknown>): Promise<unknown>;
  createFactory(params: Record<string, unknown>): Promise<unknown>;
  openVirtualChannel(params: Record<string, unknown>): Promise<unknown>;
  closeFactory(params: Record<string, unknown>): Promise<unknown>;
  spliceIn(params: Record<string, unknown>): Promise<unknown>;
  spliceOut(params: Record<string, unknown>): Promise<unknown>;
  /** Tear down the relay connection + inbound handlers. */
  close(): Promise<void>;
}

/**
 * Build a relay-backed Omnia client. Assign the returned object as the wallet's
 * `omnia` port: `configureExtensionWalletRuntime({ omnia })`.
 */
export function createRelayOmniaClient(options: RelayOmniaClientOptions = {}): RelayOmniaClient {
  const swarm = options.swarm ?? createRelayOmniaSwarm(options);
  const channels = options.channels ?? new Map<string, OmniaChannel>();

  let unsubscribe: (() => void) | undefined;
  if (options.autoAccept !== false) {
    unsubscribe = createOmniaIntegration(swarm, channels, {});
  }

  const advanced = (name: string) => async (): Promise<unknown> =>
    unsupported(`Omnia ${name} is not supported by the relay client.`);

  const runOp = async (
    name: keyof RelayOmniaOperations,
    params: Record<string, unknown>,
  ): Promise<unknown> => {
    const fn = options.operations?.[name];
    if (!fn) return unsupported(`Omnia ${name} requires wallet signing material that is not configured.`);
    return fn(params);
  };

  return {
    swarm,
    channels,
    async getChannels() {
      return {
        success: true,
        channels: [...channels.values()].map((c) => ({
          channelId: c.channelId,
          status: c.status,
          tokenId: c.tokenId,
          totalValue: c.totalValue.toString(),
          currentSequence: c.currentSequence,
          parties: c.parties.map((p) => p.partyId),
        })),
      };
    },
    openChannel: (params) => runOp('openChannel', params),
    pay: (params) => runOp('pay', params),
    settle: (params) => runOp('settle', params),
    closeChannel: (params) => runOp('closeChannel', params),
    getRoute: advanced('getRoute'),
    getSwapRate: advanced('getSwapRate'),
    createFactory: advanced('createFactory'),
    openVirtualChannel: advanced('openVirtualChannel'),
    closeFactory: advanced('closeFactory'),
    spliceIn: advanced('spliceIn'),
    spliceOut: advanced('spliceOut'),
    async close() {
      unsubscribe?.();
      await swarm.close();
    },
  };
}

export { ADVANCED_UNSUPPORTED };
