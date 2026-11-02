/**
 * RFC-024 — governed OCPP / EV charging profile.
 *
 * `@totemsdk/act-ocpp` authorizes and bounds a charging operation; the connector
 * (`@totemsdk/edge-ocpp`) carries the wire frames and the charger/CSMS owns
 * electrical protection and the control loop.
 */

export {
  OCPP_ACCEPTED,
  OcppTransportError,
  assertAccepted,
} from './transport.js';
export type {
  OcppChargingProfileRequest,
  OcppClearProfileRequest,
  OcppMeterQuery,
  OcppMeterValue,
  OcppReserveRequest,
  OcppResponse,
  OcppStartRequest,
  OcppStopRequest,
  OcppTransactionEvent,
  OcppTransactionEventType,
  OcppTransactionState,
  OcppTransportPort,
} from './transport.js';

export {
  OCPP_CORE_PROFILES,
  OCPP_VERSION_PREFERENCE,
  negotiateOcppCapabilities,
  supportsOcppProfile,
} from './capabilities.js';
export type { NegotiateOptions, OcppCapabilitySet, OcppProfileName, OcppVersion } from './capabilities.js';

export { deriveChargingEffects } from './effects.js';
export type { ChargingLimits } from './effects.js';

export { meterEvidenceDigest, reconcileChargingSession } from './meter.js';
export type {
  ChargingMeterEvidence,
  ChargingMeterQuery,
  ChargingReconcileResult,
  ChargingReconcileStatus,
} from './meter.js';

export {
  OCPP_PROTOCOL,
  chargingInterlocks,
  chargingResource,
  chargingResourceId,
  createOcppProfile,
  ocppErrorTaxonomy,
} from './profile.js';
export type { ChargingConnector, OcppProfileOptions } from './profile.js';

export { createOcppDefinitions, errorCodeOf } from './adapter.js';
export type { ChargingCommand, OcppAdapterOptions } from './adapter.js';
