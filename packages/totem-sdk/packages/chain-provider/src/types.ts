/**
 * @totemsdk/chain-provider — shared types and ChainStateProvider interface
 */

export interface CoinsQuery {
  address?: string;
  tokenId?: string;
  sendable?: boolean;
  relevant?: boolean;
  coinId?: string;
  megammr?: boolean;
}

export interface Coin {
  coinid: string;
  amount: string;
  address: string;
  miniaddress?: string;
  tokenid: string;
  token?: unknown;
  storestate?: boolean;
  state?: unknown[];
  spent?: boolean;
  mmrentry?: string;
  created?: string;
}

export interface MMRProof {
  coinid: string;
  data: unknown;
}

export interface ChainTip {
  block: number;
  hash: string;
  time?: string;
}

export interface TokenInfo {
  tokenid: string;
  name: Record<string, unknown>;
  total?: string;
  confirmed?: string;
  sendable?: string;
  coins?: number;
  script?: string;
  description?: unknown;
}

export interface TokenSearchQuery {
  name?: string;
  category?: string[];
  creatorAddress?: string;
  limit?: number;
  offset?: number;
}

export interface BroadcastResult {
  txpowid?: string;
  success: boolean;
  message?: string;
}

export interface ChainStateProvider {
  getCoins(query: CoinsQuery): Promise<Coin[]>;
  getCoin(coinId: string): Promise<Coin | null>;
  getProof(coinId: string): Promise<MMRProof>;
  getTip(): Promise<ChainTip>;
  getToken(tokenId: string): Promise<TokenInfo>;
  searchTokens(query: TokenSearchQuery): Promise<TokenInfo[]>;
  getTokensByCreator(address: string): Promise<TokenInfo[]>;
  broadcastTxPoW(txpowHex: string): Promise<BroadcastResult>;
}
