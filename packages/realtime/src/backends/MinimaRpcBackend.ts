/**
 * MinimaRpcBackend — PortfolioBackend adapter for direct Minima node RPC.
 *
 * Accepts any object that satisfies the minimal duck-typed interface below,
 * so @totemsdk/realtime does not take a hard dependency on minima-rpc.
 * Pass a `MinimaRpcClient` (or any compatible object) at construction time.
 *
 * Polling-only model:
 *   - The Minima node RPC has no native push mechanism for balance changes.
 *   - `supportsPush` is false — the manager will call `getPortfolio()` on a
 *     timer (default every 10 s, configurable via `httpPollInterval`).
 *   - For real-time push, combine with a NEWTXPOW webhook that triggers an
 *     external signal, or use LookupBackend instead.
 *
 * @example
 * ```ts
 * import { createMinimaRpcClient } from '@totemsdk/minima-rpc';
 * import { MinimaRpcBackend, createPortfolioStreamManager } from '@totemsdk/realtime';
 *
 * const rpc = createMinimaRpcClient({ host: 'localhost', port: 9005 });
 * const manager = createPortfolioStreamManager(deps, {
 *   backend: new MinimaRpcBackend(rpc),
 *   httpPollInterval: 5_000,
 * });
 * await manager.start(['MxABCD...']);
 * ```
 */

import type { PortfolioEntry, PortfolioBackend } from '../types.js';
import { toPortfolioEntry } from '../normalize.js';

/** Minimal balance row returned by MinimaRpcClient.balance(). */
interface MinimaBalance {
  tokenid: string;
  confirmed: string;
  unconfirmed: string;
  sendable?: string;
  token?: {
    name?: string;
    ticker?: string;
    decimals?: number | string;
    artimage?: string;
    webvalidate?: string;
  };
}

/**
 * Duck-typed subset of MinimaRpcClient that MinimaRpcBackend needs.
 * A real @totemsdk/minima-rpc `MinimaRpcClient` satisfies this automatically.
 */
export interface MinimaRpcLike {
  balance(params?: { address?: string; megammr?: boolean; tokendetails?: boolean }): Promise<MinimaBalance[]>;
}

export class MinimaRpcBackend implements PortfolioBackend {
  readonly supportsPush = false;

  constructor(private readonly client: MinimaRpcLike) {}

  async getPortfolio(address: string): Promise<PortfolioEntry[]> {
    const rows = await this.client.balance({ address, megammr: true, tokendetails: true });
    if (!rows || rows.length === 0) {
      return [toPortfolioEntry({ tokenid: '0x00', confirmed: '0', unconfirmed: '0' }, address)];
    }
    return rows.map(b =>
      toPortfolioEntry(
        {
          tokenid: b.tokenid,
          confirmed: b.confirmed,
          unconfirmed: b.unconfirmed,
          sendable: b.sendable,
          token: b.token,
        },
        address,
      )
    );
  }
}
