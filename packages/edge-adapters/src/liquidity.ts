import { amountToAtoms, atomsToAmount } from '@totemsdk/core';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { EdgeLiquidityPort, EdgeOperationResult } from '@totemsdk/edge';

export interface LiquidityPortConfig {
  provider: ChainStateProvider;
  /** Token to sum when getBalance is called without an explicit tokenId. Defaults to '0x00' (native Minima). */
  defaultTokenId?: string;
}

/**
 * Wraps a ChainStateProvider (chain-provider, minima-rpc, lookup-client) as
 * an EdgeLiquidityPort.
 *
 * getBalance sums sendable coins for the given address and tokenId.
 * getUtxos returns all coins as raw UTXOs (typed as unknown[] per the port contract).
 */
export function createLiquidityPortAdapter(config: LiquidityPortConfig): EdgeLiquidityPort {
  const { provider, defaultTokenId = '0x00' } = config;

  return {
    async getBalance(address: string): Promise<EdgeOperationResult<{ balance: string; tokenId: string }>> {
      try {
        const coins = await provider.getCoins({ address, tokenId: defaultTokenId, sendable: true });
        const balance = atomsToAmount(coins.reduce((sum, c) => sum + amountToAtoms(c.amount), 0n));
        return { ok: true, data: { balance, tokenId: defaultTokenId } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async getUtxos(address: string): Promise<EdgeOperationResult<{ utxos: unknown[] }>> {
      try {
        const coins = await provider.getCoins({ address });
        return { ok: true, data: { utxos: coins } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
