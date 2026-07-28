/**
 * liquidityPort.js — EdgeLiquidityPort backed by pureminima-rpc.
 *
 * pureminima-rpc is fetch-based and works in Bare/Pear without any polyfill
 * when native fetch is present (Android Pear ships it). For older Bare runtimes
 * without fetch, bareFetch from @totemsdk/pear/network is a drop-in shim.
 *
 * EdgeLiquidityPort interface:
 *   getBalance(address: string) → EdgeOperationResult<{ balance: string; tokenId: string }>
 *   getUtxos(address: string)   → EdgeOperationResult<{ utxos: unknown[] }>
 */

export function createLiquidityPort(rpc) {
  return {
    async getBalance(address) {
      try {
        const balances = await rpc.balance({ address });
        const entry = balances[0];
        if (!entry) {
          return { ok: false, error: 'No balance entry for address' };
        }
        return {
          ok: true,
          data: { balance: entry.confirmed, tokenId: entry.tokenid },
        };
      } catch (err) {
        return { ok: false, error: err.message ?? 'getBalance failed' };
      }
    },

    async getUtxos(address) {
      try {
        const coins = await rpc.coins({ address });
        return { ok: true, data: { utxos: coins } };
      } catch (err) {
        return { ok: false, error: err.message ?? 'getUtxos failed' };
      }
    },
  };
}
