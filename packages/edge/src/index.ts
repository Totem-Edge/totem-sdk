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
  EdgeLiquidityPort,
  EdgeProofPort,
  EdgeLookupPort,
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
