/**
 * Wallet-side composed Omnia relay client (RFC-034 Phase A).
 *
 * The base relay transport + channel lifecycle lives in `@totemsdk/omnia/relay`
 * (browser-safe, no Hyperswarm). This package sits **above** `@totemsdk/omnia`
 * and composes the higher-level Omnia packages — `@totemsdk/omnia-router` (routing)
 * and, for the single-party halves, `@totemsdk/omnia-factory` / `@totemsdk/omnia-splice`
 * — which themselves depend on `@totemsdk/omnia`. Composing here (never inside
 * `omnia`) keeps the dependency graph acyclic.
 *
 * Phase A serves the methods a single wallet can drive alone:
 *   - `getRoute` / `getSwapRate`  (read-only, `omnia-router`)
 *   - `createFactory`             (single-party; broadcasts the funding TxPoW)
 *   - `spliceIn` / `spliceOut`    (single-party proposer half)
 *
 * The multi-party methods (`openVirtualChannel`, `closeFactory`, `payMultiHop`)
 * stay explicit `UNSUPPORTED` until the coordination protocol (RFC-035).
 */

import {
  createRelayOmniaClient,
  type RelayOmniaClient,
  type RelayOmniaClientOptions,
} from '@totemsdk/omnia/relay';
import type { OmniaChannel } from '@totemsdk/omnia';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import {
  createFactory,
  type FactoryParticipant,
  type WotsLeaseBundle,
} from '@totemsdk/omnia-factory';
import {
  quiesceChannel,
  proposeSpliceIn,
  proposeSpliceOut,
  type SpliceLeaseProvider,
} from '@totemsdk/omnia-splice';
import {
  buildGraph,
  queryRoute,
  serializeRoute,
  serializeSwapAnnouncement,
  getSwapAnnouncements,
  type RoutingPort,
} from './routing.js';

export interface OmniaRelayClientOptions extends RelayOmniaClientOptions {
  /** Injected routing topology (defaults to the wallet's own channels). */
  routing?: RoutingPort;
}

function unsupported(message: string): { success: false; error: string; errorCode: string } {
  return { success: false, error: message, errorCode: 'UNSUPPORTED' };
}

function notFound(message: string): { success: false; error: string; errorCode: string } {
  return { success: false, error: message, errorCode: 'NOT_FOUND' };
}

function reqString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Omnia: '${key}' must be a non-empty string`);
  }
  return value;
}

function optString(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function reqBigInt(params: Record<string, unknown>, key: string): bigint {
  const value = params[key];
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error(`Omnia: '${key}' must be an integer`);
}

// Normalise a connect name (`totem_omniaPay`) or a client name (`pay`) to the
// client method name used by the base client's truth sets.
function clientName(method: string): string {
  return method.startsWith('totem_omnia')
    ? method.slice('totem_omnia'.length).charAt(0).toLowerCase() + method.slice('totem_omnia'.length + 1)
    : method;
}

function parseParticipants(value: unknown): FactoryParticipant[] {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error('Omnia createFactory: participants must contain at least two factory participants');
  }
  return value.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('Omnia createFactory: invalid factory participant');
    const p = raw as Record<string, unknown>;
    return {
      partyId: reqString(p, 'partyId'),
      publicKeyDigest: reqString(p, 'publicKeyDigest'),
      addressIndex: typeof p.addressIndex === 'number' ? p.addressIndex : 0,
      contributionAmount: reqBigInt(p, 'contributionAmount'),
      ...(optString(p, 'fundingCoinId') ? { fundingCoinId: optString(p, 'fundingCoinId') } : {}),
      ...(optString(p, 'settlementAddress') ? { settlementAddress: optString(p, 'settlementAddress') } : {}),
    };
  });
}

/**
 * Build the wallet-facing Omnia client: the base relay client plus the Phase A
 * routing and single-party operations, with a truthful `supports()`.
 */
export function createOmniaRelayClient(options: OmniaRelayClientOptions = {}): RelayOmniaClient {
  const base = createRelayOmniaClient(options);
  const routing = options.routing;
  const { signer, leaseProvider, chainProvider } = options;
  const factories = new Map<string, unknown>();

  const hasSignerMaterial = Boolean(signer && leaseProvider);
  const hasFactoryMaterial = Boolean(signer && leaseProvider && chainProvider);

  const getRoute = async (params: Record<string, unknown>): Promise<unknown> => {
    const graph = buildGraph(routing, base.channels.values());
    const route = queryRoute(graph, {
      from: reqString(params, 'fromPartyId'),
      to: reqString(params, 'toPartyId'),
      amount: reqBigInt(params, 'amount'),
      tokenId: reqString(params, 'tokenId'),
      ...(optString(params, 'targetTokenId') ? { targetTokenId: optString(params, 'targetTokenId')! } : {}),
      ...(typeof params.maxHops === 'number' ? { maxHops: params.maxHops } : {}),
    });
    if (!route) return { success: false, error: 'No route found', errorCode: 'ROUTE_NOT_FOUND' };
    return { success: true, route: serializeRoute(route) };
  };

  const getSwapRate = async (params: Record<string, unknown>): Promise<unknown> => {
    const graph = buildGraph(routing, base.channels.values());
    const announcements = getSwapAnnouncements(graph, reqString(params, 'tokenIn'), reqString(params, 'tokenOut'));
    return { success: true, announcements: announcements.map(serializeSwapAnnouncement) };
  };

  const createFactoryOp = async (params: Record<string, unknown>): Promise<unknown> => {
    if (!hasFactoryMaterial) {
      return unsupported('Omnia createFactory requires wallet signing material (signer, lease, chain provider).');
    }
    const participants = parseParticipants(params.participants);
    const tokenId = optString(params, 'tokenId') ?? '0x00';
    const tokenScale = typeof params.tokenScale === 'number' ? params.tokenScale : 0;
    const bundle: WotsLeaseBundle = {
      leaseProvider: leaseProvider as WotsLeaseProvider as unknown as WotsLeaseBundle['leaseProvider'],
      signer: signer!,
    };
    const factory = await createFactory(participants, tokenId, bundle, chainProvider as ChainStateProvider, tokenScale);
    factories.set(factory.factoryId, factory);
    return {
      success: true,
      factoryId: factory.factoryId,
      status: factory.status,
      ...(factory.fundingTxId ? { fundingTxId: factory.fundingTxId } : {}),
    };
  };

  const splice = (dir: 'in' | 'out') => async (params: Record<string, unknown>): Promise<unknown> => {
    if (!hasSignerMaterial) {
      return unsupported(`Omnia splice${dir === 'in' ? 'In' : 'Out'} requires wallet signing material.`);
    }
    const channelId = reqString(params, 'channelId');
    const channel = base.channels.get(channelId) as OmniaChannel | undefined;
    if (!channel) return notFound(`Channel ${channelId} not found`);
    const spliceLease: SpliceLeaseProvider = { signer: signer!, wotsLease: leaseProvider as WotsLeaseProvider };
    const quiesced = await quiesceChannel(channel, spliceLease);
    const proposal = dir === 'in'
      ? await proposeSpliceIn(quiesced, reqString(params, 'additionalCoinId'), reqBigInt(params, 'additionalAmount'), spliceLease)
      : await proposeSpliceOut(quiesced, reqBigInt(params, 'withdrawAmount'), reqString(params, 'withdrawAddress'), spliceLease);
    // The on-chain half (accept + finalize) is Phase B (RFC-035).
    return {
      success: true,
      channelId,
      spliceId: proposal.spliceId,
      spliceTxHex: proposal.spliceTxHex,
      proposerSignature: proposal.proposerSignature,
    };
  };

  const supports = (method: string): boolean | { supported: boolean; reason?: string } => {
    const name = clientName(method);
    if (name === 'getRoute' || name === 'getSwapRate') {
      return true;
    }
    if (name === 'createFactory') {
      return hasFactoryMaterial
        ? true
        : { supported: false, reason: 'Omnia createFactory requires wallet signing material (signer, lease, chain provider).' };
    }
    if (name === 'spliceIn' || name === 'spliceOut') {
      return hasSignerMaterial
        ? true
        : { supported: false, reason: `Omnia ${name} requires wallet signing material.` };
    }
    // Everything else defers to the base client (open/pay/settle/close are wired;
    // openVirtualChannel/closeFactory/payMultiHop remain Phase B refusals).
    return base.supports(method);
  };

  return {
    ...base,
    getRoute,
    getSwapRate,
    createFactory: createFactoryOp,
    spliceIn: splice('in'),
    spliceOut: splice('out'),
    supports,
  };
}
