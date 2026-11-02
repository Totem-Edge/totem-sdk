/**
 * @totemsdk/tx-builder/coin-provider
 *
 * Structural coin providers for edge and node-backed assembly. tx-builder does
 * not depend on a specific RPC package; adapters accept the shape the caller
 * already has (`@totemsdk/chain-provider` or `@totemsdk/minima-rpc`).
 */

export interface TxCoin {
  coinId: string;
  address: string;
  amount: string;
  tokenId: string;
  spent?: boolean;
  expiresAt?: number;
}

export interface TxCoinQuery {
  address?: string;
  tokenId?: string;
  sendable?: boolean;
  relevant?: boolean;
  coinId?: string;
}

export interface CoinProvider {
  getCoins(query: TxCoinQuery): Promise<TxCoin[]>;
  /** Serialized `coinexport` proof bytes (hex), when the provider can supply it. */
  getCoinProof?(coinId: string): Promise<string | null>;
}

export interface ChainProviderLike {
  getCoins(query: TxCoinQuery): Promise<Array<Record<string, unknown>>>;
  exportCoin?(coinId: string): Promise<{ coinid: string; data: string } | null>;
}

export interface MinimaRpcLike {
  coins(query: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  coinExport?(coinId: string): Promise<{ data?: string } | null>;
}

function mapCoin(raw: Record<string, unknown>): TxCoin {
  return {
    coinId: String(raw.coinid ?? raw.coinId ?? ""),
    address: String(raw.address ?? ""),
    amount: String(raw.amount ?? "0"),
    tokenId: String(raw.tokenid ?? raw.tokenId ?? "0x00"),
    spent: raw.spent === true,
  };
}

/** Adapt `@totemsdk/chain-provider`'s `ChainStateProvider`. */
export function fromChainProvider(provider: ChainProviderLike): CoinProvider {
  return {
    async getCoins(query) {
      const coins = await provider.getCoins(query);
      return coins.map(mapCoin);
    },
    async getCoinProof(coinId) {
      if (!provider.exportCoin) return null;
      const exported = await provider.exportCoin(coinId);
      return exported?.data ?? null;
    },
  };
}

/** Adapt a raw `MinimaRpcClient` (Hawk/local node). */
export function fromMinimaRpc(client: MinimaRpcLike): CoinProvider {
  return {
    async getCoins(query) {
      const coins = await client.coins({
        ...(query.address ? { address: query.address } : {}),
        ...(query.tokenId ? { tokenid: query.tokenId } : {}),
        ...(query.sendable !== undefined ? { sendable: query.sendable } : {}),
        ...(query.relevant !== undefined ? { relevant: query.relevant } : {}),
        ...(query.coinId ? { coinid: query.coinId } : {}),
      });
      return coins.map(mapCoin);
    },
    async getCoinProof(coinId) {
      if (!client.coinExport) return null;
      const exported = await client.coinExport(coinId);
      return exported?.data ?? null;
    },
  };
}
