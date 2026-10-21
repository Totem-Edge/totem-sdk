/**
 * RFC-062 Amendment A — Phase 1 provider contracts.
 *
 * These interfaces describe the wallet data surfaces currently reached through
 * Axia. Adapters keep the existing Axia behaviour while Hawk mode can implement
 * the same contracts against the paired node.
 */

export interface BalanceEntry {
  tokenid?: string;
  confirmed?: string;
  unconfirmed?: string;
  total?: string;
  sendable?: string;
  [key: string]: unknown;
}

export interface HistoryOptions {
  address: string;
  limit?: number;
  offset?: number;
  tokenId?: string;
}

export interface WatermarkResult {
  l1: number;
  l2: number;
  l3: number;
  [key: string]: unknown;
}

export interface ChainDataProvider {
  getBalance(address: string): Promise<BalanceEntry[]>;
  getHistory(options: HistoryOptions): Promise<unknown[]>;
}

export interface CustodyDataProvider {
  getWotsStatus(): Promise<unknown>;
  getWatermark(rootPublicKey: string): Promise<WatermarkResult | null>;
}

export interface ProviderSet {
  chain: ChainDataProvider;
  custody: CustodyDataProvider;
}
