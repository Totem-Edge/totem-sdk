/**
 * Shared connect wallet runtime — extension adoption (RFC-014 P2/P3).
 *
 * The canonical method set and per-method disposition live in
 * `@totemsdk/connect/wallet`; the extension serves the lowercase `totem_*`
 * namespace through it so no connect method is silently ignored. Legacy
 * uppercase `TOTEM_*` methods keep their existing handlers.
 *
 * Execution ports are wired here (lazily, from the background bootstrap) so the
 * shared runtime executes real wallet logic instead of returning `unsupported`:
 *   - `signer`  — bridges to the extension's existing legacy handlers
 *   - `selfHosted` — persists the RFC-013 chain-provider selection
 */

import { createWalletRuntime, isConnectMethod } from '@totemsdk/connect';
import type {
  WalletHandlerContext,
  WalletCapabilityManifest,
  WalletRuntime,
} from '@totemsdk/connect';
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

const EXTENSION_INFO = {
  wallet: 'totem-extension',
  version: '1.0.0',
  capabilities: EXTENSION_CAPABILITIES,
  status: EXTENSION_STATUS,
} as const;

let runtime: WalletRuntime | undefined;

/**
 * Install the execution ports. Called once from the background bootstrap with a
 * legacy-handler bridge so that legacy methods are never routed twice.
 */
export function configureExtensionWalletRuntime(ports: Partial<WalletHandlerContext> = {}): void {
  runtime = createWalletRuntime({ info: EXTENSION_INFO, ...ports });
}

function getRuntime(): WalletRuntime {
  if (!runtime) runtime = createWalletRuntime({ info: EXTENSION_INFO });
  return runtime;
}

/** True when `method` is a canonical connect method the extension serves via the shared runtime. */
export function isSharedConnectMethod(method: string): boolean {
  return isConnectMethod(method) && method.startsWith('totem_');
}

/** Dispatch a shared connect method through the wallet runtime. */
export function dispatchSharedConnectMethod(
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  return getRuntime().provider.request({ method, params });
}

/** The method-support manifest served by `totem_getCapabilities`. */
export function sharedConnectManifest(): WalletCapabilityManifest {
  return getRuntime().meta().manifest;
}

export { isConnectMethod };
