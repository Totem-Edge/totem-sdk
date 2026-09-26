/**
 * Shared connect wallet runtime — extension adoption (RFC-014 P2).
 *
 * The canonical method set and per-method disposition live in
 * `@totemsdk/connect/wallet`; the extension serves the lowercase `totem_*`
 * namespace through it so no connect method is silently ignored. Legacy
 * uppercase `TOTEM_*` methods keep their existing handlers.
 *
 * Ports are wired incrementally: with only `info` configured, the discovery
 * methods are served and every other method returns an explicit `UNSUPPORTED`
 * (recorded in the manifest), never a silent no-op.
 */

import { createWalletRuntime, isConnectMethod } from '@totemsdk/connect';
import type { WalletHandlerContext, WalletCapabilityManifest } from '@totemsdk/connect';
import type { TotemCapabilities, TotemProviderStatus } from '@totemsdk/connect';

const EXTENSION_CAPABILITIES: TotemCapabilities = {
  version: '1.0.0',
  wallet: {
    selfCustody: true,
    wotsTreeKey: true,
    rootIdentity: true,
    treeKeyDepth: 3,
    maxAddresses: null,
    seedExport: true,
    custodyType: 'self',
  },
  account: { multiAddress: true, accountSwitcher: true },
  chain: {
    hostedProvider: true,
    pureMinimaRpc: true,
    lookupNode: false,
    localProofVerify: false,
    pearRuntime: false,
    hyperswarm: false,
  },
  txpow: { localMining: false, progressEvents: true },
  omnia: {
    channels: false,
    routing: false,
    multiHop: false,
    crossTokenSwap: false,
    factory: false,
    virtualChannels: false,
    splicing: false,
    hyperswarm: false,
  },
  statechain: { supported: false, blindSE: false },
  scripting: { kissvm: false },
  qvac: { paymentIntents: false, explanations: false },
};

const EXTENSION_STATUS: TotemProviderStatus = {
  providerType: 'hosted',
  network: 'minima',
  relayAvailable: true,
  localMiningAvailable: false,
  pearRuntime: false,
  lookupLatencyMs: null,
};

const context: WalletHandlerContext = {
  info: {
    wallet: 'totem-extension',
    version: '1.0.0',
    capabilities: EXTENSION_CAPABILITIES,
    status: EXTENSION_STATUS,
  },
};

const runtime = createWalletRuntime(context);

/** True when `method` is a canonical connect method the extension serves via the shared runtime. */
export function isSharedConnectMethod(method: string): boolean {
  return isConnectMethod(method) && method.startsWith('totem_');
}

/** Dispatch a shared connect method through the wallet runtime. */
export function dispatchSharedConnectMethod(
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  return runtime.provider.request({ method, params });
}

/** The method-support manifest served by `totem_getCapabilities`. */
export function sharedConnectManifest(): WalletCapabilityManifest {
  return runtime.meta().manifest;
}

export { isConnectMethod };
