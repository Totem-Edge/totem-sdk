import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { EdgePaymentPort, EdgeOperationResult } from '@totemsdk/edge';

export interface MinimaL1PaymentPortConfig {
  /** ChainStateProvider used to broadcast the signed TxPoW. */
  provider: ChainStateProvider;
  /**
   * Injected signing function. Receives the payment intent and returns a
   * fully mined TxPoW hex string ready for broadcast.
   *
   * This keeps the adapter agnostic to key management — callers wire in their
   * own signer (e.g. @totemsdk/server's sendTransaction, a hardware wallet
   * bridge, or a pureminima-rpc command sequence).
   */
  sign(params: {
    toAddress: string;
    amount: string;
    tokenId: string;
    memo?: string;
  }): Promise<string>;
}

/**
 * Minima L1 payment adapter.
 *
 * Delegates transaction construction and signing to the injected `sign` function,
 * then broadcasts the result via the ChainStateProvider. This keeps key material
 * out of the adapter entirely.
 *
 * For a batteries-included L1 adapter backed by @totemsdk/server's sendTransaction,
 * wrap sendTransaction in the sign callback:
 *
 *   createMinimaL1PaymentPort({
 *     provider: new PureMinimaRpcProvider(rpcConfig),
 *     sign: ({ toAddress, amount, tokenId }) =>
 *       sendTransaction({ seed, addressIndex, toAddress, amount, tokenId, ... })
 *         .then(r => r.minedHex),
 *   })
 */
export function createMinimaL1PaymentPort(config: MinimaL1PaymentPortConfig): EdgePaymentPort {
  return {
    async pay(params: {
      recipient: string;
      amount: string;
      tokenId?: string;
      memo?: string;
    }): Promise<EdgeOperationResult<{ txpowId?: string }>> {
      try {
        const txpowHex = await config.sign({
          toAddress: params.recipient,
          amount: params.amount,
          tokenId: params.tokenId ?? '0x00',
          memo: params.memo,
        });

        const result = await config.provider.broadcastTxPoW(txpowHex);

        if (!result.success) {
          return {
            ok: false,
            error: result.message ?? 'Broadcast failed',
            errorCode: 'BROADCAST_FAILED',
          };
        }

        return { ok: true, data: { txpowId: result.txpowid } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
