import {
  findRoute,
  buildPaymentRequest,
  executeMultiHopPayment,
} from '@totemsdk/omnia-router';

const _SCALE = 100_000_000n;
function _toScaled(s: string): bigint {
  const [i, f = ''] = s.split('.');
  return BigInt(i || '0') * _SCALE + BigInt(f.padEnd(8, '0').slice(0, 8));
}
import type {
  ChannelGraph,
  ChannelOps,
  RouterChannel,
  LeaseProvider,
  RouteOptions,
} from '@totemsdk/omnia-router';
import type { EdgePaymentPort, EdgeOperationResult } from '@totemsdk/edge';

export interface OmniaL2PaymentPortConfig {
  /** Routing graph (edges + swap index). Updated externally as channels open/close. */
  graph: ChannelGraph;
  /**
   * Live channel state keyed by channelId.
   * executeMultiHopPayment mutates this map in-place as HTLCs are added/settled.
   * Callers are responsible for keeping it in sync with the on-chain state.
   */
  channels: Map<string, RouterChannel>;
  /** HTLC operations (addHTLC, fulfillHTLC, timeoutHTLC) for each channel. */
  ops: ChannelOps;
  /** WOTS lease providers keyed by channelId — required for HTLC signing. */
  leaseProviders: Map<string, LeaseProvider>;
  /** Public key digest identifying the local party in each channel. */
  localPublicKeyDigest: string;
  /**
   * Returns the current chain block height. Used to compute HTLC expiry.
   * Typically: `async () => BigInt((await provider.getTip()).block)`.
   */
  getCurrentBlock(): Promise<bigint>;
  /** HTLC timeout in blocks past the current tip. Defaults to 144 (≈24h on Minima). */
  htlcTimeoutBlocks?: bigint;
  /** Optional pathfinding overrides forwarded to findRoute. */
  routeOptions?: RouteOptions;
}

/**
 * Omnia L2 payment adapter.
 *
 * Routes payments over Omnia payment channels using multi-hop HTLC execution.
 * The local node must already have open channels forming a path to the recipient.
 *
 * pay() finds a route, builds a PaymentRequest, and executes atomically:
 *  1. Forward phase — locks HTLCs across each hop.
 *  2. Reveal phase — reveals the preimage in reverse to settle all hops.
 *  Rollback (best-effort timeoutHTLC) fires on any failure.
 */
export function createOmniaL2PaymentPort(config: OmniaL2PaymentPortConfig): EdgePaymentPort {
  const htlcTimeoutBlocks = config.htlcTimeoutBlocks ?? 144n;

  return {
    async pay(params: {
      recipient: string;
      amount: string;
      tokenId?: string;
      memo?: string;
    }): Promise<EdgeOperationResult<{ txpowId?: string }>> {
      try {
        const tokenId = params.tokenId ?? '0x00';
        const amount = _toScaled(params.amount);

        const route = findRoute(
          config.graph,
          config.localPublicKeyDigest,
          params.recipient,
          amount,
          tokenId,
          config.routeOptions
        );

        if (!route) {
          return {
            ok: false,
            error: `No route found to ${params.recipient} for amount ${params.amount} (${tokenId})`,
            errorCode: 'NO_ROUTE',
          };
        }

        const currentBlock = await config.getCurrentBlock();
        const expiryBlock = currentBlock + htlcTimeoutBlocks;

        const request = buildPaymentRequest(amount, tokenId, expiryBlock);

        const result = await executeMultiHopPayment(
          config.ops,
          config.channels,
          route,
          request,
          config.leaseProviders
        );

        if (!result.success) {
          return {
            ok: false,
            error: result.error ?? 'Multi-hop payment failed',
            errorCode: 'PAYMENT_FAILED',
          };
        }

        return { ok: true, data: { txpowId: result.preimage } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
