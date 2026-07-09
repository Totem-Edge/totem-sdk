/**
 * PureMinimaRpcProvider — thin wrapper over @totemsdk/pureminima-rpc.
 */

import type { PureMinimaClient } from '@totemsdk/pureminima-rpc';
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

export class PureMinimaRpcProvider implements ChainStateProvider {
  constructor(private readonly client: PureMinimaClient) {}

  async getCoins(query: CoinsQuery): Promise<Coin[]> {
    const result = await this.client.coins({
      address: query.address,
      tokenid: query.tokenId,
      sendable: query.sendable,
      relevant: query.relevant,
      coinid: query.coinId,
      megammr: query.megammr,
    });
    return result as unknown as Coin[];
  }

  async getCoin(coinId: string): Promise<Coin | null> {
    try {
      const coins = await this.getCoins({ coinId });
      return coins[0] ?? null;
    } catch {
      return null;
    }
  }

  async getProof(coinId: string): Promise<MMRProof> {
    return this.client.mmrProof(coinId) as unknown as MMRProof;
  }

  async getTip(): Promise<ChainTip> {
    return this.client.getTip() as unknown as ChainTip;
  }

  async getToken(tokenId: string): Promise<TokenInfo> {
    const tokens = await this.client.tokens(tokenId);
    if (!tokens || tokens.length === 0) {
      throw new Error(`Token not found: ${tokenId}`);
    }
    return tokens[0] as unknown as TokenInfo;
  }

  async searchTokens(query: TokenSearchQuery): Promise<TokenInfo[]> {
    const all = await this.client.tokens();
    let results = all as unknown as TokenInfo[];
    if (query.name) {
      const needle = query.name.toLowerCase();
      results = results.filter((t) => {
        const nameStr = JSON.stringify(t.name ?? '').toLowerCase();
        return nameStr.includes(needle);
      });
    }
    if (query.creatorAddress) {
      const addr = query.creatorAddress;
      results = results.filter((t) => {
        const desc = JSON.stringify(t.description ?? '');
        return desc.includes(addr);
      });
    }
    if (query.offset) results = results.slice(query.offset);
    if (query.limit) results = results.slice(0, query.limit);
    return results;
  }

  async getTokensByCreator(address: string): Promise<TokenInfo[]> {
    return this.searchTokens({ creatorAddress: address });
  }

  async broadcastTxPoW(txpowHex: string): Promise<BroadcastResult> {
    try {
      const result = await this.client.txnMinePost(txpowHex);
      return {
        success: true,
        txpowid: result?.txpowid,
        message: 'broadcast via PureMinima txnminepost',
      };
    } catch (e) {
      return { success: false, message: String(e) };
    }
  }
}
