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

export { allocateDeviceRange, deviceSlotForAddressIndex } from './device.js';

export {
  WatermarkMonotonicityError,
  WatermarkExhaustedError,
  LeaseNotFoundError,
  PersonalLeaseNodeNotConfiguredError,
  P2PQuorumNotImplementedError,
  OnchainWatermarkNotImplementedError,
  DeviceRangeViolationError,
} from './errors.js';
