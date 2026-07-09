/**
 * paymentPort.js — EdgePaymentPort backed by pureminima-rpc.
 *
 * Uses rpc.runCommand('send', ...) for the on-chain send path.
 * For off-chain L2 payments prefer channelManager.sendPayment() from
 * src/omnia/channelManager.js — it settles instantly via an Omnia state update
 * and consumes no on-chain TxPoW mining cost.
 *
 * EdgePaymentPort interface:
 *   pay({ recipient, amount, tokenId?, memo? }) → EdgeOperationResult<{ txpowId? }>
 */

export function createPaymentPort(rpc) {
  return {
    async pay({ recipient, amount, tokenId, memo }) {
      try {
        const params = {
          address: recipient,
          amount: String(amount),
        };
        if (tokenId) params.tokenid = tokenId;
        if (memo) params.state = [{ port: 99, data: memo }];

        const result = await rpc.runCommand('send', params);

        if (!result?.txpowid) {
          return { ok: false, error: 'send command returned no txpowid', errorCode: 'NO_TXPOWID' };
        }
        return { ok: true, data: { txpowId: result.txpowid } };
      } catch (err) {
        return {
          ok: false,
          error: err.message ?? 'pay failed',
          errorCode: err.code ?? 'SEND_ERROR',
        };
      }
    },
  };
}
