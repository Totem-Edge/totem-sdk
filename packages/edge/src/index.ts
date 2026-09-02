/**
 * @module @totemsdk/edge
 *
 * Unified developer-facing runtime for Totem Edge.
 * Composes identity, manifest, wallet/payment/proof/lookup/policy capabilities
 * via injected ports. Adapter-neutral.
 */

export { EDGE_VERSION } from './constants.js';

export { EdgeCapabilityError } from './errors.js';

export type {
  EdgeDeviceKind,
  EdgeOperationResult,
  EdgeDevice,
  EdgeRuntime,
  EdgeProviderProfile,
  EdgeServiceRegistration,
  EdgeReceipt,
} from './types.js';

export type {
  EdgePaymentPort,
  EdgeOmniaPort,
  EdgeLiquidityPort,
  EdgeProofPort,
  EdgeLookupPort,
  EdgeLocationPort,
  EdgePolicyPort,
  EdgeIdentityPort,
  EdgeManifestPort,
  EdgeKeyLeasePort,
  EdgeStreamPort,
  EdgePubSubPort,
  EdgeRuntimePorts,
} from './ports.js';

export type { EdgeCapability, EdgeCapabilitySet } from './capabilities.js';
export {
  createCapabilitySet,
  hasCapability,
  assertCapability,
  edgeCapabilitiesFromTotemCapabilities,
} from './capabilities.js';

export { createEdgeRuntime } from './runtime.js';
export { createEdgeDevice } from './device.js';

export { createEdgeReceipt, verifyEdgeReceipt } from './receipts.js';

export {
  createEdgeProviderProfile,
  createEdgeServiceRegistration,
  createEdgeServiceManifest,
  bindEdgeServiceIdentity,
} from './provider.js';

// ── Machine-native purchasing & bounded negotiation ─────────────────────────
export {
  EdgeBuyer,
  NegotiationEngine,
  EdgeWorkPolicy,
  EdgeTxPowAdapter,
  createPurchaseSession,
  PurchaseError,
  NegotiationError,
  termsHash,
  proposalDigest,
  workRequiredDigest,
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
  type BuyerOptions,
  type BuyOptions,
  type NegotiationEngineOptions,
  type SessionOptions,
} from './purchasing/index.js';
