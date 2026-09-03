/**
 * purchasing/index.ts — Machine-native purchasing and bounded negotiation.
 *
 * Public surface:
 *   edge.buy()      — demand-side orchestration (EdgeBuyer.buy)
 *   edge.negotiate()— bounded peer-to-peer negotiation (EdgeBuyer.negotiate)
 *
 * Exports the protocol types applications need. Internal state transitions
 * are not exposed as top-level Edge methods.
 */

export { EdgeBuyer, type BuyerOptions, type BuyOptions } from './buyer.js';
export { NegotiationEngine, type NegotiationEngineOptions } from './engine.js';
export { EdgeWorkPolicy, EdgeTxPowAdapter } from './admission.js';
export { createPurchaseSession, type SessionOptions } from './session.js';
export { PurchaseError, NegotiationError, PURCHASE_ERROR_CODES } from './errors.js';
export { termsHash, proposalDigest, workRequiredDigest } from './terms.js';
export { type NegotiationRecord, createNegotiationRecord } from './state.js';
export {
  type NegotiationStore,
  type PurchaseStore,
  type PrincipalNegotiationStore,
  type OutboxMessage,
  InMemoryNegotiationStore,
  InMemoryPurchaseStore,
  InMemoryPrincipalNegotiationStore,
} from './store.js';
export {
  type NegotiationTransport,
  type TransportMessageContext,
  InMemoryNegotiationTransport,
} from './transport.js';
export {
  messageId,
  messageType,
  type ReplayLedger,
  type ReplayEntry,
  type ReplayOutcome,
  InMemoryReplayLedger,
} from './messages.js';
export {
  ingress,
  MAX_NEGOTIATION_MESSAGE_BYTES,
  type IngressOptions,
  type IngressResult,
} from './ingress.js';
export {
  createPurchaseRecord,
  idempotencyKey,
  type PurchaseRecord,
  type PurchaseStatus,
  TERMINAL_PURCHASE_STATUSES,
} from './purchase.js';
export {
  type OutboxStore,
  type OutboxEntry,
  InMemoryOutboxStore,
} from './outbox.js';

export {
  PURCHASING_VERSION,
  DEFAULT_MAX_ROUNDS,
  DEFAULT_NEGOTIATION_TTL_MS,
  DEFAULT_MAX_CONCURRENT_NEGOTIATIONS,
  DEFAULT_NEGOTIATION_COOLDOWN_MS,
  DEFAULT_MAX_NEGOTIATIONS_PER_WINDOW,
  DEFAULT_NEGOTIATION_WINDOW_MS,
  TERMINAL_NEGOTIATION_STATES,
  type PurchaseIntent,
  type TradeTerms,
  type TradeProposal,
  type TradeAgreement,
  type WorkRequired,
  type ProposalAcceptance,
  type ProposalRejection,
  type NegotiationCancellation,
  type NegotiationRequest,
  type NegotiationMessage,
  type NegotiationState,
  type NegotiationStrategy,
  type NegotiationLimits,
  type NegotiationResult,
  type PrincipalLimits,
  type LocalWorkBudget,
  type WorkDifficultyPolicy,
  type WorkMode,
  type PurchaseSession,
  type PurchaseResult,
  type PurchaseEvent,
  type ResourceAdapter,
  type ResourceHandle,
  type UsageEvent,
} from './types.js';
