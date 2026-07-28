/**
 * LookupClientProvider — ChainStateProvider backed by a @totemsdk/lookup-client instance.
 *
 * Accepts any object that satisfies LookupClientLike (structural duck-typing),
 * so @totemsdk/lookup-client remains a peer dependency: chain-provider does not
 * bundle or import it at runtime. The caller is responsible for constructing the
 * LookupClient and passing it in.
 *
 * @example
 * ```ts
 * import { connectLookupNode, LookupClientProvider } from '@totemsdk/lookup-client';
 *
 * const client = await connectLookupNode({ hyperswarmTopic: 'deadbeef...' });
 * const provider = new LookupClientProvider(client);
 *
 * const tip   = await provider.getTip();
 * const coins = await provider.getCoins({ address: 'Mx...' });
 * ```
 *
 * Use inside a CompositeProvider for sovereign-first / hosted-fallback:
 *
 * ```ts
 * import { CompositeProvider, HostedProvider, LookupClientProvider } from '@totemsdk/chain-provider';
 * import { connectLookupNode } from '@totemsdk/lookup-client';
 *
 * const client   = await connectLookupNode({ hyperswarmTopic: 'abc...' });
 * const fallback = new HostedProvider({ baseUrl: 'https://api.axia.to', projectId: '...' });
 *
 * const provider = new CompositeProvider(
 *   new LookupClientProvider(client),
 *   fallback,
 * );
 * ```
 */

import type {
  BroadcastResult,
  ChainStateProvider,
  ChainTip,
  Coin,
  CoinsQuery,
  MMRProof,
  TokenInfo,
  TokenSearchQuery,
} from '../types.js';

/**
 * Structural interface describing the subset of LookupClient methods that
 * LookupClientProvider requires. Any object satisfying this interface can be
 * passed in — most commonly a `LookupClient` from @totemsdk/lookup-client.
 */
export interface LookupClientLike {
  getCoins(query: CoinsQuery): Promise<Coin[]>;
  getCoin(coinId: string): Promise<Coin | null>;
  getProof(coinId: string): Promise<MMRProof>;
  getTip(): Promise<ChainTip>;
  getToken(tokenId: string): Promise<TokenInfo>;
  searchTokens(query: TokenSearchQuery): Promise<TokenInfo[]>;
  getTokensByCreator(address: string): Promise<TokenInfo[]>;
  broadcastTxPoW(txpowHex: string): Promise<BroadcastResult>;
}

export class LookupClientProvider implements ChainStateProvider {
  constructor(private readonly _client: LookupClientLike) {}

  getCoins(query: CoinsQuery): Promise<Coin[]> {
    return this._client.getCoins(query);
  }

  getCoin(coinId: string): Promise<Coin | null> {
    return this._client.getCoin(coinId);
  }

  getProof(coinId: string): Promise<MMRProof> {
    return this._client.getProof(coinId);
  }

  getTip(): Promise<ChainTip> {
    return this._client.getTip();
  }

  getToken(tokenId: string): Promise<TokenInfo> {
    return this._client.getToken(tokenId);
  }

  searchTokens(query: TokenSearchQuery): Promise<TokenInfo[]> {
    return this._client.searchTokens(query);
  }

  getTokensByCreator(address: string): Promise<TokenInfo[]> {
    return this._client.getTokensByCreator(address);
  }

  broadcastTxPoW(txpowHex: string): Promise<BroadcastResult> {
    return this._client.broadcastTxPoW(txpowHex);
  }
}
