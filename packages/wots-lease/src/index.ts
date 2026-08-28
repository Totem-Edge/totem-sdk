export type {
  UnavailableReason,
  SigningIndices,
  LeaseStatus,
  TreeWatermark,
  WotsWatermarkState,
  LeaseCertificate,
  LeaseReservation,
  ReserveParams,
  LocalWatermark,
  ConflictRecord,
  SyncResult,
  WotsLeaseProvider,
  JournalEntry,
  DeviceKeyRange,
  PersonalLeaseNodeConfig,
  QuorumAttestation,
  QuorumPeer,
  CertificateSigner,
  P2PQuorumLeaseProviderConfig,
  OnchainWatermarkProviderConfig,
} from './types.js';

export {
  WotsWatermarkStore,
  flatIndex,
  fromFlatIndex,
} from './watermark.js';

export { LeaseJournal } from './journal.js';

export { LocalLeaseProvider } from './local.js';

export { AxiaLeaseProvider } from './axia.js';
export type { AxiaLeaseProviderConfig } from './axia.js';

export { HybridLeaseProvider } from './hybrid.js';
export type { HybridLeaseProviderConfig } from './hybrid.js';

export {
  PersonalLeaseNodeProvider,
  P2PQuorumLeaseProvider,
  OnchainWatermarkProvider,
} from './stubs.js';

export { P2PQuorumLeaseProvider as QuorumLeaseProvider } from './quorum.js';
export { OnchainWatermarkProvider as ChainWatermarkProvider } from './onchain.js';

export { allocateDeviceRange, deviceSlotForAddressIndex } from './device.js';

export {
  WatermarkMonotonicityError,
  WatermarkExhaustedError,
  LeaseNotFoundError,
  IndicesUnavailableError,
  PersonalLeaseNodeNotConfiguredError,
  P2PQuorumNotImplementedError,
  OnchainWatermarkNotImplementedError,
  QuorumUnavailableError,
  QuorumConflictError,
  OnchainWatermarkError,
  DeviceRangeViolationError,
} from './errors.js';
