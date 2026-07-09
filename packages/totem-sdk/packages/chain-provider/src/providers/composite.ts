/**
 * CompositeProvider — tries primary provider, falls back to secondary on any error.
 */

import type {
  ChainStateProvider,
  CoinsQuery,
  Coin,
  MMRProof,
  ChainTip,
  TokenInfo,
  TokenSearchQuery,
  BroadcastResult,
} from '../types.js';

export class CompositeProvider implements ChainStateProvider {
  constructor(
    private readonly primary: ChainStateProvider,
    private readonly fallback: ChainStateProvider,
    private readonly onFallback?: (method: string, error: unknown) => void,
  ) {}

  private withArg<T>(method: string, arg: unknown): Promise<T> {
    const p = this.primary as unknown as Record<string, (a: unknown) => Promise<T>>;
    const f = this.fallback as unknown as Record<string, (a: unknown) => Promise<T>>;
    return p[method](arg).catch((err: unknown) => {
      this.onFallback?.(method, err);
      return f[method](arg);
    });
  }

  private withNoArg<T>(method: string): Promise<T> {
    const p = this.primary as unknown as Record<string, () => Promise<T>>;
    const f = this.fallback as unknown as Record<string, () => Promise<T>>;
    return p[method]().catch((err: unknown) => {
      this.onFallback?.(method, err);
      return f[method]();
    });
  }

  getCoins(query: CoinsQuery): Promise<Coin[]> {
    return this.withArg('getCoins', query);
  }

  getCoin(coinId: string): Promise<Coin | null> {
    return this.withArg('getCoin', coinId);
  }

  getProof(coinId: string): Promise<MMRProof> {
    return this.withArg('getProof', coinId);
  }

  getTip(): Promise<ChainTip> {
    return this.withNoArg('getTip');
  }

  getToken(tokenId: string): Promise<TokenInfo> {
    return this.withArg('getToken', tokenId);
  }

  searchTokens(query: TokenSearchQuery): Promise<TokenInfo[]> {
    return this.withArg('searchTokens', query);
  }

  getTokensByCreator(address: string): Promise<TokenInfo[]> {
    return this.withArg('getTokensByCreator', address);
  }

  broadcastTxPoW(txpowHex: string): Promise<BroadcastResult> {
    return this.withArg('broadcastTxPoW', txpowHex);
  }
}
