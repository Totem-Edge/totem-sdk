/**
 * Experimental KISSVM templates — NOT AUDITED.
 *
 * These templates are exported from the `@totemsdk/kissvm/experimental`
 * subpath only. They must not be used in production without an independent
 * security review against a Minima node.
 *
 * The stable templates (eltoo, governance, statechain, wots-lease, temporal,
 * txpow, identity, manifest, authority, agent-policy, industrial-action,
 * liquidity-bond, provider-bond, lookup-protocol, proof) remain on the
 * package root export.
 */

export {
  buildCompliancePipeline,
  buildStandardCompliancePipeline,
  buildSupplyChainPipeline,
} from './compliance.js';
export type { ComplianceStage, CompliancePipelineConfig } from './compliance.js';

export {
  buildSensorProofScript,
  buildSensorFleetPolicy,
  buildSensorProofChain,
} from './sensor-proof.js';
export type { SensorProofConfig } from './sensor-proof.js';

export {
  buildFirmwareUpdateScript,
} from './firmware-update.js';
export type { FirmwareUpdateConfig } from './firmware-update.js';

export {
  buildPaymentChannelScript,
  buildChannelFactoryScript,
} from './payment-channel.js';
export type { PaymentChannelConfig } from './payment-channel.js';

export {
  buildStateMachineScript,
  buildStateMachineWorkflow,
  onOffStateMachine,
  hvacStateMachine,
  productionStateMachine,
  robotArmStateMachine,
} from './state-machine.js';
export type { StateMachineConfig } from './state-machine.js';

export {
  assetLayer,
  manufacturerLayer,
  productLayer,
  regulatoryLayer,
  ownerLayer,
  siteLayer,
  operatorLayer,
  emergencyLayer,
} from './layers.js';

export {
  buildThresholdRecoveryScript,
  buildEpochRotationScript,
  buildDelegatedCredentialScript,
  buildInstitutionalHierarchy,
  buildSuccessionScript,
} from './recovery.js';
export type {
  ThresholdRecoveryConfig,
  EpochRotationConfig,
  DelegatedCredentialConfig,
  InstitutionalHierarchyConfig,
  SuccessionConfig,
} from './recovery.js';

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
} from './commercial.js';

export {
  buildDataAccessConsentScript,
  buildGdprSubjectRequestScript,
  buildDataPortabilityScript,
  buildZkProofIntegrationScript,
  buildDataEscrowScript,
} from './data-privacy.js';

export {
  commissioningLayer,
  transferLayer,
  keyRotationLayer,
  recoveryLayer,
  decommissioningLayer,
  remoteSupportLayer,
  configurationProfileLayer,
  certificateIssuanceLayer,
} from './device-lifecycle.js';

export {
  buildRecTradingScript,
  buildMicrogridScript,
  buildP2PEnergyScript,
  buildDemandResponseScript,
  buildNetMeteringScript,
} from './energy.js';

export {
  buildMedicalDeviceRegulationScript,
  buildPatientConsentScript,
  buildClinicalTrialScript,
  buildPrescriptionScript,
  buildHealthDataAccessScript,
} from './healthcare.js';

export {
  buildDocumentNotarizationScript,
  buildTimestampVerificationScript,
  buildSmartContractExecutionScript,
  buildPowerOfAttorneyScript,
  buildMultiJurisdictionScript,
} from './legal.js';

export {
  buildAssetTokenizationScript,
  buildFractionalizationScript,
  buildAuditTrailScript,
  buildDistributionScript,
  buildShareTransferScript,
  buildRedemptionScript,
  buildAssetDisposalScript,
  buildRwaPolicyTree,
} from './rwa-lifecycle.js';

export {
  buildProvenanceScript,
  buildColdChainScript,
  buildBillOfLadingScript,
  buildCustomsClearanceScript,
  buildInventoryScript,
  buildQualityInspectionScript,
} from './supply-chain.js';

export {
  buildMultiSigTreasuryScript,
  buildBudgetAllocationScript,
  buildTimeLockedReserveScript,
  buildProposalExecutionScript,
  buildStreamingPaymentScript,
  buildTreasuryDelegationChain,
} from './treasury.js';

export {
  buildWeightedVotingScript,
  buildLiquidDemocracyScript,
  buildQuadraticVotingScript,
  buildElectionVerificationScript,
  buildDelegateRecallScript,
} from './voting.js';
