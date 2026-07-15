export type BondAsset = 'MINIMA' | 'TOTEM' | string;

export type BondPurpose =
  | 'hard-collateral'
  | 'service-level'
  | 'reputation'
  | 'governance'
  | 'marketplace-access'
  | 'dispute-bond'
  | 'grant-accountability'
  | 'app-specific'
  | 'community-specific';

export type BondStatus =
  | 'declared'
  | 'pending'
  | 'active'
  | 'expiring'
  | 'expired'
  | 'invalid'
  | 'disputed';

export type BondLockType =
  | 'manual-attestation'
  | 'visible-balance'
  | 'declared-reserve'
  | 'future-l1-lock'
  | 'future-covenant';

export type ProviderBondVerifyCode =
  | 'OK'
  | 'MANIFEST_SIGNATURE_INVALID'
  | 'MANIFEST_EXPIRED'
  | 'IDENTITY_NOT_AUTHORISED'
  | 'IDENTITY_REVOKED'
  | 'IDENTITY_EXPIRED'
  | 'BOND_EXTENSION_HASH_MISMATCH'
  | 'BOND_OWNER_NOT_AUTHORISED'
  | 'BOND_RECOVERY_NOT_AUTHORISED'
  | 'PROBE_SIGNER_NOT_AUTHORISED'
  | 'INCIDENT_SIGNER_NOT_AUTHORISED'
  | 'SCORE_SIGNER_NOT_AUTHORISED'
  | 'BOND_PROOF_INVALID'
  | 'BOND_AMOUNT_INSUFFICIENT'
  | 'BOND_ASSET_NOT_ACCEPTED'
  | 'BOND_PURPOSE_NOT_ACCEPTED'
  | 'REQUIRES_LIVE_VERIFIER'
  | 'UNSUPPORTED_PROOF_TYPE';

export type ProviderRecommendation =
  | 'recommended'
  | 'acceptable'
  | 'risky'
  | 'avoid'
  | 'offline'
  | 'unbonded'
  | 'expired';

export type ProbeType =
  | 'heartbeat'
  | 'endpoint'
  | 'latency'
  | 'service-capability'
  | 'bond-proof-freshness'
  | 'manual-observation';

export type IncidentType =
  | 'downtime'
  | 'high-latency'
  | 'failed-probe'
  | 'invalid-response'
  | 'invalid-bond-proof'
  | 'manual-dispute';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus = 'open' | 'acknowledged' | 'resolved' | 'rejected';

export type BondProofType =
  | 'manual'
  | 'declared'
  | 'visible-balance'
  | 'totem-proof'
  | 'future-live-chain';

export interface ProviderBondVerifyResult {
  ok: boolean;
  reason?: string;
  code?: ProviderBondVerifyCode | string;
  requiresLiveVerifier?: boolean;
}

export interface BondStatusContext {
  now?: number;
  currentHeight?: bigint;
  expiringThresholdBlocks?: bigint;
}

export interface ProviderBondAssetDeclaration {
  bondId: string;
  asset: BondAsset;
  amount: bigint;
  purpose: BondPurpose;
  lockType: BondLockType;
  status: BondStatus;
  createdAt?: number;
  expiresAtBlock?: bigint;
  metadata?: Record<string, unknown>;
}

export interface BondProofRef {
  proofId: string;
  bondId: string;
  providerId: string;
  proofType: BondProofType;
  asset: BondAsset;
  amount?: bigint;
  createdAt?: number;
  expiresAt?: number;
  proof?: unknown;
  metadata?: Record<string, unknown>;
}

export interface ProviderBondExtension {
  providerId: string;
  bondId?: string;
  bondOwnerAddress?: string;
  bondRecoveryAddress?: string;
  probeSignerAddress?: string;
  incidentSignerAddress?: string;
  scoreSignerAddress?: string;
  bondStack?: ProviderBondAssetDeclaration[];
  bondProofs?: BondProofRef[];
  liquidityBondRefs?: string[];
  score?: ProviderScore;
  incidentSummary?: IncidentSummary;
  extensionHash?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderBondManifest {
  edgeServiceManifestId: string;
  edgeService: import('@totemsdk/manifest').EdgeServiceManifest;
  signedEdgeService?: import('@totemsdk/manifest').SignedManifest<import('@totemsdk/manifest').EdgeServiceManifest>;
  providerBond: ProviderBondExtension;
}

export interface ProviderScore {
  providerId: string;
  score: number;
  recommendation: ProviderRecommendation;
  bondScore: number;
  identityScore: number;
  reliabilityScore: number;
  incidentScore: number;
  computedAt: number;
  reasons: string[];
}

export interface IncidentSummary {
  total: number;
  open: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  lastIncidentAt?: number;
}

export interface ProbeResult {
  probeId: string;
  providerId: string;
  type: ProbeType;
  ok: boolean;
  latencyMs?: number;
  observedAt: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface IncidentRecord {
  incidentId: string;
  providerId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  createdAt: number;
  resolvedAt?: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderPolicy {
  serviceType?: string;
  minScore?: number;
  requireIdentity?: boolean;
  requireActiveBond?: boolean;
  requireMinimaHardCollateral?: boolean;
  minBondAmount?: bigint;
  acceptedAssets?: BondAsset[];
  acceptedPurposes?: BondPurpose[];
  maxIncidentSeverity?: IncidentSeverity;
  maxHeartbeatAgeMs?: number;
  now?: number;
}

export interface PolicyMatch {
  providerId: string;
  provider: ProviderBondManifest;
  matched: boolean;
  score?: ProviderScore;
  reasons: string[];
  failures: string[];
}

export interface ProviderBondRegistryState {
  providers: Record<string, ProviderBondManifest>;
  bondProofs: Record<string, BondProofRef[]>;
  probes: Record<string, ProbeResult[]>;
  incidents: Record<string, IncidentRecord[]>;
  scores: Record<string, ProviderScore>;
  updatedAt?: number;
}

export interface ProviderScoringWeights {
  identity: number;
  bond: number;
  reliability: number;
  incidents: number;
}

export interface ComputeProviderScoreParams {
  provider: ProviderBondManifest;
  bondProofs?: BondProofRef[];
  probes?: ProbeResult[];
  incidents?: IncidentRecord[];
  now?: number;
  currentHeight?: bigint;
  weights?: ProviderScoringWeights;
}

export interface CreateProviderBondManifestParams {
  edgeService: import('@totemsdk/manifest').EdgeServiceManifest;
  signedEdgeService?: import('@totemsdk/manifest').SignedManifest<import('@totemsdk/manifest').EdgeServiceManifest>;
  providerBond: ProviderBondExtension;
}

export interface VerifyProviderBondManifestParams {
  manifest: ProviderBondManifest;
  identityGraph?: unknown;
  now?: number;
}

export interface BindProviderManifestToIdentityParams {
  manifest: ProviderBondManifest;
  identityGraph: unknown;
}

export interface VerifyProviderManifestIdentityParams {
  manifest: ProviderBondManifest;
  identityGraph: unknown;
}

export interface VerifyProviderBondAddressesParams {
  manifest: ProviderBondManifest;
  identityGraph: unknown;
}

export interface AssertProviderControlsAddressParams {
  manifest: ProviderBondManifest;
  address: string;
  identityGraph: unknown;
}

export interface BondProofVerifier {
  verify(proof: BondProofRef): Promise<ProviderBondVerifyResult>;
}

export interface VerifyBondStackParams {
  bondStack: ProviderBondAssetDeclaration[];
  bondProofs?: BondProofRef[];
  verifier?: BondProofVerifier;
}

export interface RecordProbeParams {
  providerId: string;
  type: ProbeType;
  ok: boolean;
  latencyMs?: number;
  message?: string;
  metadata?: Record<string, unknown>;
  now?: number;
}

export interface RecordIncidentParams {
  providerId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  message?: string;
  metadata?: Record<string, unknown>;
  now?: number;
}
