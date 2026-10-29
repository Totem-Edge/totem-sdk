/**
 * Active local-node RPC resolution (RFC-013 / RFC-062 / RFC-073).
 *
 * Returns a raw `MinimaRpcClient` for the configured, consented Hawk node.
 * `null` means Axia mode (or a self-hosted URL that has not been consented),
 * in which case callers must keep their existing Axia path.
 *
 * This is the command-level counterpart to `resolveActiveChainProvider`:
 * the chain provider covers typed reads, while transaction assembly needs the
 * raw command surface (`coinexport`, `txnimport`, `txnpost`, `txnmine`,
 * `sendtransaction`).
 */

import { createMinimaRpcClient, parseMinimaRpcUrl } from '@totemsdk/chain-provider';
import type { MinimaRpcClient } from '@totemsdk/chain-provider';
import { activeChainProviderStore } from '../config/activeChainProvider';
import { loadWalletNetworkConfig, loadSelfHostedConsent } from '../config/selfHosted';
import { loadRuntimeRouting } from './runtimeRouting';
import { ensureHawkNodeSupported } from './nodeSupport';

export { UnsupportedHawkNodeError } from './nodeSupport';

export interface ActiveNodeRpc {
  readonly client: MinimaRpcClient;
  readonly url: string;
  readonly mode: 'minima-rpc' | 'composite';
}

/**
 * Resolve the configured local node, or `null` when the wallet is in Axia mode
 * or the persisted node URL is not consented. Fails closed: a URL without
 * matching user consent is never used.
 */
export async function resolveActiveNodeRpc(): Promise<ActiveNodeRpc | null> {
  const store = activeChainProviderStore();
  const config = await loadWalletNetworkConfig(store);
  const routing = await loadRuntimeRouting({ allowAxiaFallback: config.chain.fallbackToAxia });

  let url: string | undefined;
  let mode: 'minima-rpc' | 'composite' = 'minima-rpc';

  if (routing.pairedNode) {
    // The paired capability map is authoritative. A node that does not
    // advertise `chain` is not usable for transactions, even if a stale
    // manual URL exists in the config.
    if (routing.chain.source !== 'node' || !routing.chain.url) {
      return null;
    }
    url = routing.chain.url;
    mode = config.chain.fallbackToAxia ? 'composite' : 'minima-rpc';
  } else {
    if (config.chain.mode === 'axia') return null;
    url = config.chain.minimaRpcUrl;
    if (!url) return null;

    const consented = await loadSelfHostedConsent(store);
    if (consented !== url) {
      console.warn('[activeNode] self-hosted node URL is not consented; refusing to use it');
      return null;
    }
    mode = config.chain.mode === 'composite' ? 'composite' : 'minima-rpc';
  }

  const { host, port, ssl } = parseMinimaRpcUrl(url);
  const client = createMinimaRpcClient({
    host,
    port,
    ssl,
    ...(config.chain.minimaRpcUser ? { username: config.chain.minimaRpcUser } : {}),
    ...(config.chain.minimaRpcPass ? { password: config.chain.minimaRpcPass } : {}),
    // `txnpost mine:true` mines synchronously (the node caps its own wait at
    // 120s), so allow more than the default 30s request timeout.
    timeoutMs: 180_000,
  });

  await ensureHawkNodeSupported(client, url);
  return { client, url, mode };
}

/** True when transaction assembly should use the local node instead of Axia. */
export async function isHawkTransactionMode(): Promise<boolean> {
  return (await resolveActiveNodeRpc()) !== null;
}
