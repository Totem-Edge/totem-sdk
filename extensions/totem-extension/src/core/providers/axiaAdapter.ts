/**
 * RFC-062 Amendment A — Axia adapter.
 *
 * Wraps the existing AxiaRpcClient calls. This preserves Axia mode exactly while
 * giving the wallet a provider seam for Hawk mode.
 */

import type { AxiaRpcClient } from '../api/AxiaRpcClient';
import type {
  BalanceEntry,
  ChainDataProvider,
  CustodyDataProvider,
  HistoryOptions,
  ProviderSet,
  WatermarkResult,
} from './contracts';

type AxiaCaller = Pick<AxiaRpcClient, 'call' | 'getWatermark'>;

export function createAxiaChainProvider(client: AxiaCaller): ChainDataProvider {
  return {
    async getBalance(address: string): Promise<BalanceEntry[]> {
      const { result } = await client.call<BalanceEntry[]>('balance', { address });
      return result;
    },
    async getHistory(options: HistoryOptions): Promise<unknown[]> {
      const { result } = await client.call<unknown[]>('history', {
        address: options.address,
        ...(options.limit !== undefined ? { limit: options.limit } : {}),
        ...(options.offset !== undefined ? { offset: options.offset } : {}),
        ...(options.tokenId ? { tokenid: options.tokenId } : {}),
      });
      return result;
    },
  };
}

export function createAxiaCustodyProvider(client: AxiaCaller): CustodyDataProvider {
  return {
    async getWotsStatus(): Promise<unknown> {
      const { result } = await client.call<unknown>('wots/status', {});
      return result;
    },
    async getWatermark(rootPublicKey: string): Promise<WatermarkResult | null> {
      return client.getWatermark(rootPublicKey) as Promise<WatermarkResult>;
    },
  };
}

export function createAxiaProviderSet(client: AxiaCaller): ProviderSet {
  return {
    chain: createAxiaChainProvider(client),
    custody: createAxiaCustodyProvider(client),
  };
}
