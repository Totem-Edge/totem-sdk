export type {
  RouterChannel,
  ChannelParty,
  ChannelHTLC,
  HTLCStatus,
  ChannelSigner,
  ChannelOps,
  HTLCParams,
  LeaseProvider,
  ChannelGraphEdge,
  ChannelGraph,
  RoutingHop,
  SwapHop,
  Route,
  CrossTokenRoute,
  SwapAnnouncement,
  PaymentRequest,
  PaymentResult,
  RouteOptions,
} from './types.js';

export {
  createChannelGraph,
  addChannel,
  removeChannel,
  announceSwap,
  getSwapAnnouncements,
} from './graph.js';

export {
  findRoute,
  findCrossTokenRoute,
  applyRate,
  parseRateToScaled,
} from './pathfind.js';

export {
  buildPaymentRequest,
  buildCrossTokenRequest,
} from './request.js';

export {
  executeMultiHopPayment,
  executeCrossTokenPayment,
  cancelPayment,
  buildRouterFeeProof,
  computeRouterFeeProofHash,
  ROUTER_FEE_PROOF_DOMAIN,
} from './execute.js';
export type { RouterFeeProof } from './types.js';

// RFC-035 B4 — pluggable forwarding envelopes (cleartext now; onion behind the same seam).
export { createCleartextRoutingCodec } from './forward.js';
export type { RoutingEnvelopeCodec, ForwardHop, PeelResult } from './forward.js';

export {
  createDurableRouterLedger,
} from './durable-router-ledger.js';
export type {
  SettledSegment,
  RouterLedgerState,
  DurableRouterLedger,
  DurableRouterLedgerOptions,
} from './durable-router-ledger.js';
