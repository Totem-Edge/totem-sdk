/**
 * Shared connect wallet runtime — PWA adoption (RFC-014 P5).
 *
 * The canonical method set and per-method disposition live in
 * `@totemsdk/connect/wallet`. The PWA serves the lowercase `totem_*` namespace
 * through it (after its existing inline/approval handlers), so every connect
 * method resolves to an explicit handled/unsupported — never a silent stub.
 */

import { createWalletRuntime, isConnectMethod } from '@totemsdk/connect';
import type { WalletHandlerContext, WalletCapabilityManifest } from '@totemsdk/connect';
import type { TotemCapabilities, TotemProviderStatus } from '@totemsdk/connect';

const PWA_CAPABILITIES: TotemCapabilities = {
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
  txpow: { localMining: false, progressEvents: false },
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

const PWA_STATUS: TotemProviderStatus = {
  providerType: 'hosted',
  network: 'minima',
  relayAvailable: true,
  localMiningAvailable: false,
  pearRuntime: false,
  lookupLatencyMs: null,
};

const context: WalletHandlerContext = {
  info: {
    wallet: 'totem-pwa',
    version: '1.0.0',
    capabilities: PWA_CAPABILITIES,
    status: PWA_STATUS,
  },
};

const runtime = createWalletRuntime(context);

/** True when `method` is a canonical connect method served via the shared runtime. */
export function isSharedConnectMethod(method: string): boolean {
  return isConnectMethod(method) && method.startsWith('totem_');
}

export function dispatchSharedConnectMethod(
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  return runtime.provider.request({ method, params });
}

export function sharedConnectManifest(): WalletCapabilityManifest {
  return runtime.meta().manifest;
}

export { isConnectMethod };
