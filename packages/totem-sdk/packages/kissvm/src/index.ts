export { evaluateScript } from './eval.js';
export { simulateSpend } from './simulate.js';
export { buildWitness } from './witness.js';
export { parseScript } from './parser.js';
export { KissvmLimitError, KissvmRuntimeError } from './errors.js';
export { sigdig } from './eval.js';
export { MiniNumber } from './MiniNumber.js';

// WASM bridge (Rust-backed evaluator and parser)
export { evaluateScriptWasm, parseScriptWasm } from './wasm-sync.js';

export type {
  Value,
  EvalResult,
  ScriptWitness,
  ScriptProof,
  CoinData,
  OutputData,
  TxContext,
  ASTNode,
} from './types.js';

export type { WitnessInput } from './witness.js';

// ─── MAST infrastructure ────────────────────────────────────────────────────

export type {
  PolicyNode,
  PolicyTree,
  ProofLink,
  ProofChain,
  StateTransition,
  PrevStateWorkflow,
  VerificationResult,
} from './mast/types.js';

export {
  compileMastTree,
  compilePolicyGraph,
  verifyScriptMembership,
  computeCanonicalScriptHash,
  computeCanonicalScriptAddress,
} from './mast/mast-compiler.js';
export type {
  MinimaScriptProof,
  CompiledMast,
  CompiledPolicyNode,
  PolicyGraphNode,
  PolicyDelegationEdge,
  PolicyGraph,
  CompiledRecursivePolicy,
} from './mast/mast-compiler.js';

export {
  buildPolicyTree,
  findPolicyNode,
  getPolicyPath,
  getPolicyLeaves,
} from './mast/policy-tree.js';
export type { PolicyNodeInput } from './mast/policy-tree.js';

export {
  buildProofChain,
  verifyProofChain,
  toMinimaProofExpression,
  toTotemProofExpression,
  toProofExpression,
  toNestedMastScript,
} from './mast/proof-chain.js';

export {
  buildStateTransition,
  buildPrevStateWorkflow,
  counterWorkflow,
  vestingWorkflow,
  roundBasedWorkflow,
  timelockWorkflow,
} from './mast/prevstate.js';

export {
  buildLayeredPolicy,
  buildLayeredMastScript,
  buildLayerSubset,
  STANDARD_LAYERS,
} from './mast/layered-policy.js';
export type { PolicyLayer, LayeredPolicyConfig } from './mast/layered-policy.js';

export {
  buildPolicyAnchorScript,
  buildPolicyAnchorState,
  buildRootRotationScript,
  buildEpochAdvancementScript,
} from './mast/policy-anchor.js';
export type { PolicyAnchorConfig } from './mast/policy-anchor.js';

// ─── Templates (EXPERIMENTAL) ───────────────────────────────────────────────

export {
  buildCompliancePipeline,
  buildStandardCompliancePipeline,
  buildSupplyChainPipeline,
} from './templates/compliance.js';
export type { ComplianceStage, CompliancePipelineConfig } from './templates/compliance.js';

export {
  buildSensorProofScript,
  buildSensorFleetPolicy,
  buildSensorProofChain,
} from './templates/sensor-proof.js';
export type { SensorProofConfig } from './templates/sensor-proof.js';

export {
  buildFirmwareUpdateScript,
} from './templates/firmware-update.js';
export type { FirmwareUpdateConfig } from './templates/firmware-update.js';

export {
  buildPaymentChannelScript,
  buildChannelFactoryScript,
} from './templates/payment-channel.js';
export type { PaymentChannelConfig } from './templates/payment-channel.js';

export {
  buildStateMachineScript,
  buildStateMachineWorkflow,
  onOffStateMachine,
  hvacStateMachine,
  productionStateMachine,
  robotArmStateMachine,
} from './templates/state-machine.js';
export type { StateMachineConfig } from './templates/state-machine.js';

export {
  assetLayer,
  manufacturerLayer,
  productLayer,
  regulatoryLayer,
  ownerLayer,
  siteLayer,
  operatorLayer,
  emergencyLayer,
} from './templates/layers.js';
export type { PolicyLayer as TemplatePolicyLayer } from './mast/layered-policy.js';

export {
  buildThresholdRecoveryScript,
  buildEpochRotationScript,
  buildDelegatedCredentialScript,
  buildInstitutionalHierarchy,
  buildSuccessionScript,
} from './templates/recovery.js';
export type {
  ThresholdRecoveryConfig,
  EpochRotationConfig,
  DelegatedCredentialConfig,
  InstitutionalHierarchyConfig,
  SuccessionConfig,
} from './templates/recovery.js';

export {
  maasLayer,
  payPerUseLayer,
  featureLicenseLayer,
  warrantyLayer,
  escrowLayer,
  leasingLayer,
  telemetryLicenseLayer,
  carbonProgrammeLayer,
  usageBasedInsuranceLayer,
  vehicleToGridLayer,
} from './templates/commercial.js';

export {
  buildDataAccessConsentScript,
  buildGdprSubjectRequestScript,
  buildDataPortabilityScript,
  buildZkProofIntegrationScript,
  buildDataEscrowScript,
} from './templates/data-privacy.js';

export {
  commissioningLayer,
  transferLayer,
  keyRotationLayer,
  recoveryLayer,
  decommissioningLayer,
  remoteSupportLayer,
  configurationProfileLayer,
  certificateIssuanceLayer,
} from './templates/device-lifecycle.js';

export {
  buildRecTradingScript,
  buildMicrogridScript,
  buildP2PEnergyScript,
  buildDemandResponseScript,
  buildNetMeteringScript,
} from './templates/energy.js';

export {
  buildMedicalDeviceRegulationScript,
  buildPatientConsentScript,
  buildClinicalTrialScript,
  buildPrescriptionScript,
  buildHealthDataAccessScript,
} from './templates/healthcare.js';

export {
  buildDocumentNotarizationScript,
  buildTimestampVerificationScript,
  buildSmartContractExecutionScript,
  buildPowerOfAttorneyScript,
  buildMultiJurisdictionScript,
} from './templates/legal.js';

export {
  buildAssetTokenizationScript,
  buildFractionalizationScript,
  buildAuditTrailScript,
  buildDistributionScript,
  buildShareTransferScript,
  buildRedemptionScript,
  buildAssetDisposalScript,
  buildRwaPolicyTree,
} from './templates/rwa-lifecycle.js';

export {
  buildProvenanceScript,
  buildColdChainScript,
  buildBillOfLadingScript,
  buildCustomsClearanceScript,
  buildInventoryScript,
  buildQualityInspectionScript,
} from './templates/supply-chain.js';

export {
  buildMultiSigTreasuryScript,
  buildBudgetAllocationScript,
  buildTimeLockedReserveScript,
  buildProposalExecutionScript,
  buildStreamingPaymentScript,
  buildTreasuryDelegationChain,
} from './templates/treasury.js';

export {
  buildWeightedVotingScript,
  buildLiquidDemocracyScript,
  buildQuadraticVotingScript,
  buildElectionVerificationScript,
  buildDelegateRecallScript,
} from './templates/voting.js';
