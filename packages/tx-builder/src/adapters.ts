export interface KeyValueStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface CoinFetcher {
  fetchCoins(addresses: string[], tokenId?: string): Promise<SpendableCoin[]>;
}

export interface SpendableCoin {
  coinId: string;
  address: string;
  amount: string;
  tokenid: string;
  created: number;
}
