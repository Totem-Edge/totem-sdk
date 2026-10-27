/**
 * LookupClientProvider — implements ChainStateProvider using a connected LookupClient.
 *
 * Replaces the LookupNodeProvider stub in @totemsdk/chain-provider.
 * Use directly or inside a CompositeProvider for primary/fallback support:
 *
 * @example
 * ```ts
 * import { CompositeProvider } from '@totemsdk/chain-provider';
 * import { connectLookupNode, LookupClientProvider } from '@totemsdk/lookup-client';
 *
 * const lookupClient = await connectLookupNode({ hyperswarmTopic: 'abc...' });
 * const axia = new HostedProvider({ baseUrl: 'https://api.axia.to' });
 *
 * const provider = new CompositeProvider(
 *   new LookupClientProvider(lookupClient),  // primary (sovereign, no DB)
 *   axia,                                    // fallback (hosted)
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
} from '@totemsdk/chain-provider';
import type { LookupClient } from './client.js';
import type { ReplicatedRead } from '@totemsdk/replication';

export class LookupClientProvider implements ChainStateProvider {
  constructor(private readonly _client: LookupClient) {}

  getCoins(query: CoinsQuery): Promise<Coin[]> {
    return this._client.getCoins(query);
  }

  /** RFC-057 Phase 4: freshness-aware coins read from the configured replica. */
  getCoinsWithFreshness(query: CoinsQuery): Promise<ReplicatedRead<Coin[]>> {
    return this._client.getCoinsReplicated(query);
  }

  /** RFC-057 Phase 4: freshness-aware chain-tip read from the configured replica. */
  getTipWithFreshness(): Promise<ReplicatedRead<ChainTip>> {
    return this._client.getTipReplicated();
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
