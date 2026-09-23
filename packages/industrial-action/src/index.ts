export type {
  ParameterType,
  ParameterSchema,
  ContextField,
  ContextSchema,
  ActionSchema,
  ActionError,
  ActionProposal,
  Condition,
  ConditionResult,
  CreateProposalParams,
} from './types.js'

export { toHex, canonicalJson, hashCanonical } from '@totemsdk/core'

export {
  computeActionProposalId,
  computeActionExecutionId,
  computeCommitmentHash,
  computeReceiptId,
  computeOperationId,
  computeAuthorityBindingHash,
} from './ids.js'

export {
  IndustrialActionError,
  ActionDefinitionError,
  ActionValidationError,
  ActionExecutionError,
  ActionConditionError,
  ActionGovernanceError,
  ActionCommitmentError,
} from './errors.js'

export {
  validateParameters,
  validateContext,
  assertValidParameters,
  assertValidContext,
} from './definition.js'

export {
  createProposal,
  verifyCommitment,
  assertValidProposal,
  isProposalExpired,
  isProposalExecutable,
} from './proposal.js'

export {
  createCommitment,
  verifyCommitmentBinding,
  serializeCommitmentPayload,
} from './commitment.js'

export {
  evaluateConditions,
  createCondition,
} from './condition.js'

export {
  toEdgeActionDefinition,
  runWithPolicy,
} from './edge-adapter.js'
export type {
  DeviceOpBase,
  PreparedDeviceOp,
  ExecutionPolicy,
  IndustrialActionDefinition,
  FailureMode,
  ActionOutcome,
  IndustrialExecutionResult,
  ToEdgeActionOptions,
} from './edge-adapter.js'

export { createDurableDeviceOperationStore } from './operation-store.js'
export type {
  DeviceOperationStore,
  DeviceOperationRecord,
  OperationStatus,
  OperationClaim,
  DurableDeviceOperationStoreOptions,
} from './operation-store.js'

export { createIndustrialReceipt, verifyIndustrialReceipt } from './industrial-receipt.js'
export type {
  IndustrialReceiptFields,
  IndustrialReceiptPayload,
  IndustrialReceiptExtras,
} from './industrial-receipt.js'

export {
  createUnitRegistry,
  createDefaultUnitRegistry,
  defaultUnitRegistry,
  isQuantity,
  checkQuantity,
} from './units.js'
export type { Dimension, Unit, Quantity, QuantityConstraint, UnitRegistry } from './units.js'

export {
  createResourceRegistry,
  resourceIdKey,
  toWireQuantity,
  safeStateFor,
} from './resources.js'
export type {
  ResourceId,
  ResourceKind,
  ResourceProtocol,
  ResourceAddress,
  Resource,
  ResourceRegistry,
  SafeState,
} from './resources.js'

export { createInterlockRegistry } from './interlocks.js'
export type {
  Interlock,
  InterlockKind,
  InterlockContext,
  InterlockResult,
  InterlockFailure,
  InterlockRegistry,
} from './interlocks.js'

export { createDurableResourceLockManager } from './locks.js'
export type {
  ResourceLock,
  ResourceLockManager,
  AcquireResult,
  DurableResourceLockManagerOptions,
} from './locks.js'

export { createDeviceErrorTaxonomy, defaultDeviceErrorTaxonomy } from './error-taxonomy.js'
export type {
  DeviceErrorClass,
  DeviceErrorClassification,
  DeviceErrorTaxonomy,
} from './error-taxonomy.js'
