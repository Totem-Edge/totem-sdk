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
import { createChannel, updateState } from './channel.js';
import { proposeSettlement, markChannelClosing, markChannelClosed } from './settlement.js';
import { hexToBytes } from '@totemsdk/core';
import type { OmniaSwarm, OmniaSwarmConfig } from './messaging-types.js';
import type { ChannelParticipant, ChannelSigner, CreateChannelParams, OmniaChannel } from './types.js';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { ChainStateProvider } from '@totemsdk/chain-provider';

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

export interface RelayOmniaOperationsOptions {
  swarm: OmniaSwarm;
  channels: Map<string, OmniaChannel>;
  /** The wallet's own channel participant (party id + WOTS public-key digest). */
  localParticipant: ChannelParticipant;
  /** Wallet signer (WOTS) — no raw keys leave the wallet. */
  signer: ChannelSigner;
  /** RFC-013 WOTS lease provider for signing-index allocation. */
  leaseProvider: WotsLeaseProvider;
  /** Chain provider used to broadcast the funding / settlement TxPoW. */
  chainProvider: ChainStateProvider;
}

function reqString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Omnia: '${key}' must be a non-empty string`);
  }
  return value;
}

function reqBigInt(params: Record<string, unknown>, key: string): bigint {
  const value = params[key];
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error(`Omnia: '${key}' must be an integer`);
}

/**
 * Local channel operations backed by the wallet's signing material — the port of
 * `@totemsdk/omnia-host`'s `openChannel`/`pay`/`settle`/`closeChannel` handlers
 * (RFC-014 §6.3), browser-safe (no SQLite/RPC/Node builtins).
 *
 * `openChannel` expects the wallet/dApp to supply `fundingWitnessHex` (the signed
 * funding-input witness) — the wallet signs the funding transaction itself.
 */
export function createRelayOmniaOperations(
  options: RelayOmniaOperationsOptions,
): RelayOmniaOperations {
  const { swarm, channels, localParticipant, signer, leaseProvider, chainProvider } = options;

  return {
    async openChannel(params) {
      const remote: ChannelParticipant = {
        partyId: reqString(params, 'remotePartyId'),
        publicKeyDigest: reqString(params, 'remotePublicKeyDigest'),
        addressIndex: typeof params.remoteAddressIndex === 'number' ? params.remoteAddressIndex : 0,
        ...(typeof params.remoteSettlementAddress === 'string'
          ? { settlementAddress: params.remoteSettlementAddress }
          : {}),
      };
      const createParams: CreateChannelParams = {
        localParty: localParticipant,
        remoteParty: remote,
        localAmount: reqBigInt(params, 'localAmount'),
        remoteAmount: reqBigInt(params, 'remoteAmount'),
        ...(typeof params.tokenId === 'string' ? { tokenId: params.tokenId } : {}),
        fundingCoinId: reqString(params, 'fundingCoinId'),
        fundingWitnessBytes: hexToBytes(reqString(params, 'fundingWitnessHex').replace(/^0x/i, '')),
      };
      const created = await createChannel(createParams, chainProvider);
      const channel: OmniaChannel = { ...created.channel, localSigner: signer };
      channels.set(channel.channelId, channel);

      const peer = await swarm.connectToPeer(remote.publicKeyDigest, channel.channelId);
      await peer.sendMessage({
        type: 'CHANNEL_PROPOSAL',
        channelId: channel.channelId,
        nonce: Date.now(),
        payload: created.proposal,
      });
      return { success: true, channelId: channel.channelId, fundingTxId: channel.fundingTxId };
    },

    async pay(params) {
      const channelId = reqString(params, 'channelId');
      const amount = reqBigInt(params, 'amount');
      const channel = channels.get(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);
      const localPartyId = localParticipant.partyId;
      const remote = channel.parties.find((party) => party.partyId !== localPartyId);
      if (!remote) throw new Error('Channel counterparty not found');
      const localBalance = channel.balances[localPartyId] ?? 0n;
      if (amount <= 0n || localBalance < amount) throw new Error('Insufficient channel balance');

      const result = await updateState(
        channel,
        {
          newBalances: {
            ...channel.balances,
            [localPartyId]: localBalance - amount,
            [remote.partyId]: (channel.balances[remote.partyId] ?? 0n) + amount,
          },
        },
        leaseProvider,
        signer,
      );
      if (result.error) throw new Error(result.error);
      channels.set(channelId, result.channel);

      const peer = await swarm.connectToPeer(remote.publicKeyDigest, channelId);
      await peer.sendMessage({ type: 'STATE_UPDATE', channelId, nonce: Date.now(), payload: result.signedState });
      return {
        success: true,
        channelId,
        sequence: result.channel.currentSequence,
        localBalance: result.channel.balances[localPartyId]?.toString(),
        remoteBalance: result.channel.balances[remote.partyId]?.toString(),
      };
    },

    async settle(params) {
      const channelId = reqString(params, 'channelId');
      const channel = channels.get(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);
      const closing = markChannelClosing(channel, 'mutual');
      const settlement = await proposeSettlement(closing, leaseProvider, {
        signer,
        chainProvider,
        partyAddresses: Object.fromEntries(
          closing.parties.map((party) => [party.partyId, party.settlementAddress ?? party.publicKeyDigest]),
        ),
      });
      channels.set(channelId, markChannelClosed(closing));
      return {
        success: true,
        channelId,
        settlementTxId: settlement.settlementPayload.txpowId,
        finalBalances: Object.fromEntries(
          Object.entries(settlement.settlementPayload.balances).map(([key, value]) => [key, value.toString()]),
        ),
      };
    },

    async closeChannel(params) {
      const channelId = reqString(params, 'channelId');
      const channel = channels.get(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);
      channels.set(channelId, markChannelClosed(channel));
      return { success: true, channelId };
    },
  };
}

export interface RelayOmniaClientOptions extends RelayOmniaSwarmOptions {
  /** Pre-built swarm (e.g. a host-managed relay connection). Defaults to one built from the relay URL. */
  swarm?: OmniaSwarm;
  /** Channel registry (defaults to a fresh in-memory Map). */
  channels?: Map<string, OmniaChannel>;
  /**
   * Local channel operations. When absent (and no signing material is supplied),
   * `openChannel`/`pay`/`settle`/`closeChannel` return an explicit `UNSUPPORTED`
   * result.
   */
  operations?: RelayOmniaOperations;
  /** Wallet channel participant; with the ports below, auto-builds operations. */
  localParticipant?: ChannelParticipant;
  signer?: ChannelSigner;
  leaseProvider?: WotsLeaseProvider;
  chainProvider?: ChainStateProvider;
  /** Wire inbound CHANNEL_PROPOSAL/STATE_UPDATE/SETTLEMENT_PROPOSAL handling. Default true. */
  autoAccept?: boolean;
}

function unsupported(message: string): { success: false; error: string; errorCode: string } {
  return { success: false, error: message, errorCode: 'UNSUPPORTED' };
}

/**
 * The Omnia methods this client does not implement (advanced topology ops /
 * multi-party coordination). They resolve to an explicit reason so the wallet
 * manifest stays truthful — including `payMultiHop`, which the base client does
 * not implement at all (so it must still be reported unsupported, not absent).
 */
export const ADVANCED_UNSUPPORTED = new Set([
  'getRoute',
  'getSwapRate',
  'payMultiHop',
  'createFactory',
  'openVirtualChannel',
  'closeFactory',
  'spliceIn',
  'spliceOut',
]);

/** Methods that require wallet signing material to execute. */
export const MUTATION_METHODS = new Set([
  'openChannel',
  'pay',
  'settle',
  'closeChannel',
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
  /**
   * Per-method capability probe (RFC-014 Amendment A). Accepts either the Omnia
   * client method name (`createFactory`) or the connect name
   * (`totem_omniaCreateFactory`); returns a verdict so the wallet manifest
   * reflects what this client will actually attempt.
   */
  supports(method: string): boolean | { supported: boolean; reason?: string };
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

  // Auto-build local channel operations when the wallet supplies signing material.
  const operations: RelayOmniaOperations | undefined =
    options.operations
    ?? (options.localParticipant && options.signer && options.leaseProvider && options.chainProvider
      ? createRelayOmniaOperations({
          swarm,
          channels,
          localParticipant: options.localParticipant,
          signer: options.signer,
          leaseProvider: options.leaseProvider,
          chainProvider: options.chainProvider,
        })
      : undefined);

  const advanced = (name: string) => async (): Promise<unknown> =>
    unsupported(`Omnia ${name} is not supported by the relay client.`);

  // Normalise a connect name (`totem_omniaPay`) or a client name (`pay`) to the
  // client method name used by the truth sets.
  const clientName = (method: string): string =>
    method.startsWith('totem_omnia')
      ? method.slice('totem_omnia'.length).charAt(0).toLowerCase() + method.slice('totem_omnia'.length + 1)
      : method;

  const supports = (method: string): boolean | { supported: boolean; reason?: string } => {
    const name = clientName(method);
    if (ADVANCED_UNSUPPORTED.has(name)) {
      return { supported: false, reason: `Omnia ${name} is not supported by the relay client.` };
    }
    if (!operations && MUTATION_METHODS.has(name)) {
      return { supported: false, reason: `Omnia ${name} requires wallet signing material that is not configured.` };
    }
    return true;
  };

  const runOp = async (
    name: keyof RelayOmniaOperations,
    params: Record<string, unknown>,
  ): Promise<unknown> => {
    const fn = operations?.[name];
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
    supports,
    async close() {
      unsubscribe?.();
      await swarm.close();
    },
  };
}

export { ADVANCED_UNSUPPORTED as ADVANCED_UNSUPPORTED_SET };
