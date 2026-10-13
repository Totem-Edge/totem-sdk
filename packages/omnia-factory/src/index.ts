export type {
  FactoryStatus,
  FactoryParticipant,
  FactorySignature,
  FactoryLogEntry,
  ChannelFactory,
  FactorySettlementPayload,
  FactoryDisputePayload,
  FactoryLeaseOps,
  WotsLeaseBundle,
  OmniaChannel,
} from './types.js';

export {
  buildFactoryScript,
  buildAndHashFactoryScript,
  scriptAddress,
  normalizeScript,
} from './script.js';

export { computeFactoryStateCommitment } from './commitment.js';

export {
  createFactory,
  acceptFactory,
  reallocate,
  enforceConservation,
  signFactoryOpening,
  verifyFactorySignature,
  applyFactorySignature,
} from './factory.js';
export type { FactoryOpeningSignature } from './factory.js';

// RFC-035 B2 — factory opening round-trip over the coordination transport.
export {
  createFactoryCoordination,
  type FactoryCoordination,
  type FactoryCoordinationDeps,
  type FactoryApproval,
  type FactoryApprovalRequest,
} from './coordination.js';

export {
  openVirtualChannel,
  closeVirtualChannel,
} from './virtual.js';

export {
  closeFactory,
  buildDisputePayload,
} from './settlement.js';

export {
  createDurableFactoryStore,
} from './durable-factory-store.js';
export type {
  FactoryRegistryState,
  DurableFactoryStore,
  DurableFactoryStoreOptions,
} from './durable-factory-store.js';
