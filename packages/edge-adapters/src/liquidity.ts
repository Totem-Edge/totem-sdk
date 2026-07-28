import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { EdgeLiquidityPort, EdgeOperationResult } from '@totemsdk/edge';

const _SCALE = 100_000_000n;
function _toScaled(s: string): bigint {
  const [i, f = ''] = s.split('.');
  return BigInt(i || '0') * _SCALE + BigInt(f.padEnd(8, '0').slice(0, 8));
}
function _fromScaled(n: bigint): string {
  if (n === 0n) return '0';
  const frac = (n % _SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  return frac ? `${n / _SCALE}.${frac}` : `${n / _SCALE}`;
}

export interface LiquidityPortConfig {
  provider: ChainStateProvider;
  /** Token to sum when getBalance is called without an explicit tokenId. Defaults to '0x00' (native Minima). */
  defaultTokenId?: string;
}

/**
 * Wraps a ChainStateProvider (chain-provider, pureminima-rpc, lookup-client) as
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
        const balance = _fromScaled(coins.reduce((sum, c) => sum + _toScaled(c.amount), 0n));
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
