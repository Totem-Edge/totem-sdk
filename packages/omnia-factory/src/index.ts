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
  factoryBalanceStateVariables,
  factoryEscapeStateVariable,
  factoryPartySetRoot,
  factoryPartyRootStateVariable,
  factoryPartyProof,
  factoryBalanceSetRoot,
  factoryBalanceProof,
  factoryDistributionOutputs,
  buildFactoryDistributionScript,
  FACTORY_BALANCE_PORT_BASE,
  FACTORY_ESCAPE_PORT,
  FACTORY_ESCAPE_DELAY_BLOCKS,
  FACTORY_MAX_PARTICIPANTS,
  FACTORY_PARTY_ROOT_PORT,
  FACTORY_BALANCE_ROOT_PORT,
  MSHS_PORT_FLOOR,
  scriptAddress,
  normalizeScript,
} from './script.js';

export { computeFactoryStateCommitment } from './commitment.js';
export type { FactoryDistributionOutput, FactoryDistributionScriptConfig } from './script.js';

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
  buildVirtualChannelOpen,
  signVirtualChannelOpen,
  verifyVirtualChannelOpenSignature,
  assembleVirtualChannelOpen,
} from './virtual.js';
export type {
  VirtualChannelOpenPlan,
  VirtualChannelOpenSignature,
} from './virtual.js';

export {
  closeFactory,
  buildDisputePayload,
  buildFactorySettlement,
  signFactorySettlement,
  verifyFactorySettlementSignature,
  assembleFactorySettlement,
} from './settlement.js';
export type {
  FactorySettlementDraft,
  FactorySettlementSignature,
} from './settlement.js';

export {
  createDurableFactoryStore,
} from './durable-factory-store.js';
export type {
  FactoryRegistryState,
  DurableFactoryStore,
  DurableFactoryStoreOptions,
} from './durable-factory-store.js';
