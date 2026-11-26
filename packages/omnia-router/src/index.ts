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
  buildAuthenticatedRouterFeeProof,
  verifyRouterFeeProof,
  computeRouterFeeProofHash,
  ROUTER_FEE_PROOF_DOMAIN,
  PendingRefundError,
} from './execute.js';
export { planRouteExpiry, hopTimeout } from './expiry.js';
export type { ExpiryPlan, ExpiryPlanResult, ExpiryPolicy } from './expiry.js';
export { validateRoute } from './route-validation.js';
export type { RouteBinding, RouteValidationResult } from './route-validation.js';
export type {
  RouterFeeProof,
  RouterSignedState,
  RouterStateTransition,
} from './types.js';
export type { VerifyRouterFeeProofOptions } from './execute.js';

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
