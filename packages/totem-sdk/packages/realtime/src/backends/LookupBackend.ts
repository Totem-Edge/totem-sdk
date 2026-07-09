/**
 * LookupBackend — PortfolioBackend adapter for @totemsdk/lookup-client.
 *
 * Accepts any object that satisfies the minimal duck-typed interface below,
 * so @totemsdk/realtime does not take a hard dependency on lookup-client.
 * Pass a `LookupClient` (or any compatible object) at construction time.
 *
 * Push model:
 *   - watchAddress() registers the address on the lookup node.
 *   - subscribeCoinUpdates() receives COIN_UPDATE push messages.
 *   - On each COIN_UPDATE the backend re-queries getCoins() for the affected
 *     address so the listener always sees the canonical aggregated balance,
 *     not just the changed coin.
 *
 * @example
 * ```ts
 * import { connectLookupNode } from '@totemsdk/lookup-client';
 * import { LookupBackend, createPortfolioStreamManager } from '@totemsdk/realtime';
 *
 * const client = await connectLookupNode({ hyperswarmTopic: 'deadbeef...' });
 * const manager = createPortfolioStreamManager(deps, {
 *   backend: new LookupBackend(client),
 * });
 * await manager.start(['MxABCD...']);
 * ```
 */

import type { PortfolioEntry, PortfolioBackend, BackendUnsubscribe } from '../types.js';
import { toPortfolioEntry } from '../normalize.js';

const _SCALE = 100_000_000n;
function _toScaled(s: string): bigint {
  const [i, f = ''] = s.split('.');
  return BigInt(i || '0') * _SCALE + BigInt(f.padEnd(8, '0').slice(0, 8));
}
function _fromScaled(n: bigint): string {
  if (n === 0n) return '0';
  const frac = (n % _SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  return frac ? `${n / _SCALE}.${frac}` : `${n / _SCALE}`;
}

/** Minimal coin shape returned by LookupClient.getCoins(). */
interface LookupCoin {
  coinid: string;
  amount: string;
  address: string;
  tokenid: string;
  spent?: boolean;
  token?: {
    name?: string;
    ticker?: string;
    decimals?: number | string;
    artimage?: string;
    webvalidate?: string;
  };
}

/** Minimal coin-update event pushed by the lookup node. */
interface LookupCoinUpdateEvent {
  eventType: 'new' | 'spent' | 'confirmed';
  coin: unknown;
  block: number;
}

/**
 * Duck-typed subset of LookupClient that LookupBackend needs.
 * A real @totemsdk/lookup-client `LookupClient` satisfies this automatically.
 */
export interface LookupLike {
  getCoins(query: { address?: string; relevant?: boolean; sendable?: boolean }): Promise<LookupCoin[]>;
  watchAddress(address: string): Promise<void>;
  subscribeCoinUpdates(cb: (event: LookupCoinUpdateEvent) => void): () => void;
}

export class LookupBackend implements PortfolioBackend {
  readonly supportsPush = true;

  constructor(private readonly client: LookupLike) {}

  async getPortfolio(address: string): Promise<PortfolioEntry[]> {
    const coins = await this.client.getCoins({ address, relevant: true });
    return aggregateCoins(coins, address);
  }

  async subscribe(
    addresses: string[],
    onUpdate: (address: string, entries: PortfolioEntry[]) => void,
  ): Promise<BackendUnsubscribe> {
    for (const address of addresses) {
      await this.client.watchAddress(address);
    }

    const unsub = this.client.subscribeCoinUpdates(async (event: LookupCoinUpdateEvent) => {
      const coin = event.coin as LookupCoin | null;
      if (!coin?.address) return;
      try {
        const coins = await this.client.getCoins({ address: coin.address, relevant: true });
        onUpdate(coin.address, aggregateCoins(coins, coin.address));
      } catch {
        // Re-query failed — caller will get stale data until next update; safe to swallow
      }
    });

    return unsub;
  }
}

/** Aggregate an array of unspent coins into per-token PortfolioEntry objects. */
function aggregateCoins(coins: LookupCoin[], address: string): PortfolioEntry[] {
  const map = new Map<string, { total: bigint; coin: LookupCoin }>();
  for (const coin of coins) {
    if (coin.spent) continue;
    const tokenid = coin.tokenid ?? '0x00';
    const existing = map.get(tokenid);
    if (existing) {
      existing.total += _toScaled(coin.amount ?? '0');
    } else {
      map.set(tokenid, { total: _toScaled(coin.amount ?? '0'), coin });
    }
  }

  if (map.size === 0) {
    return [toPortfolioEntry({ tokenid: '0x00', confirmed: '0', unconfirmed: '0' }, address)];
  }

  return Array.from(map.entries()).map(([tokenid, { total, coin }]) => {
    const totalStr = _fromScaled(total);
    return toPortfolioEntry(
      {
        tokenid,
        confirmed: totalStr,
        unconfirmed: '0',
        sendable: totalStr,
        total: totalStr,
        token: coin.token,
      },
      address,
    );
  });
}
