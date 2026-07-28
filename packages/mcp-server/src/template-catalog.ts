export interface TemplateEntry {
  template: string
  functions: string[]
  configTypes: string[]
  package: string | string[] | null
  keywords: string[]
  description: string
}

export const TEMPLATE_CATALOG: TemplateEntry[] = [
  {
    template: 'authority',
    functions: ['buildMandateEnforcementScript', 'buildActionAuthorizationScript', 'buildAuthorityRevocationScript', 'buildUsageTrackingScript'],
    configTypes: ['MandateEnforcementConfig', 'ActionAuthorizationConfig', 'AuthorityRevocationConfig', 'UsageTrackingConfig'],
    package: 'authority',
    keywords: ['mandate', 'authorization', 'replay protection', 'nonce', 'usage tracking', 'revocation epoch', 'scope', 'action auth', 'governance authority'],
    description: 'Mandate enforcement, action authorization with nonce replay protection, usage tracking against limits, and revocation epoch scripts',
  },
  {
    template: 'agent-policy',
    functions: ['buildPaymentIntentScript', 'buildAgentProposalScript', 'buildPolicyEnforcementScript'],
    configTypes: ['PaymentIntentConfig', 'AgentProposalConfig', 'PolicyEnforcementConfig'],
    package: 'agent-policy',
    keywords: ['payment intent', 'agent proposal', 'policy enforcement', 'risk threshold', 'confidence', 'status transition', 'autonomous agent', 'policy rules'],
    description: 'Autonomous agent payment intents, proposal state machines with confidence thresholds, and policy rule enforcement',
  },
  {
    template: 'eltoo',
    functions: ['buildEltooChannelScript', 'buildEltooFundingScript', 'buildEltooSettlementScript', 'buildFactoryFundingScript'],
    configTypes: ['EltooConfig', 'FactoryConfig'],
    package: ['omnia', 'omnia-factory'],
    keywords: ['eltoo', 'ln symmetry', 'channel', 'payment channel', 'funding', 'settlement', 'sequence', 'coinage', 'multisig', 'n-of-n', 'factory', 'channel factory'],
    description: 'Eltoo/LN-Symmetry channel scripts with settlement/update paths, channel funding scripts, and N-of-N factory funding scripts',
  },
  {
    template: 'governance',
    functions: ['buildProposalStateMachineScript', 'buildVoteSubmissionScript', 'buildVoteTallyScript', 'buildExecutionMandateScript', 'buildTreasuryExecutionScript', 'computeScriptHash'],
    configTypes: ['ProposalConfig', 'VoteSubmissionConfig', 'VoteTallyConfig', 'ExecutionMandateConfig', 'TreasuryExecutionConfig'],
    package: 'governance',
    keywords: ['proposal', 'state machine', 'vote submit', 'vote tally', 'quorum', 'execution mandate', 'treasury', 'execution delay', 'multisig', 'governance', 'dao', 'voting', 'commitments'],
    description: 'Proposal lifecycle 7-status state machine, vote submission with nonce/weight/window, on-chain vote tally with batch delta ports, execution mandate with timelock+multisig+commitments, and treasury fund release',
  },
  {
    template: 'industrial-action',
    functions: ['buildCommitScript', 'buildRevealScript', 'buildActionStateMachineScript', 'buildEscrowEnforcementScript'],
    configTypes: ['CommitConfig', 'RevealConfig', 'ActionStateMachineConfig', 'EscrowEnforcementConfig'],
    package: 'industrial-action',
    keywords: ['industrial action', 'strike', 'commit reveal', 'hash commit', 'preimage reveal', 'state machine', 'notice period', 'max duration', 'escrow', 'condition enforcement'],
    description: 'Industrial action scripts: hash-commit and preimage reveal, 6-status action FSM (proposed/noticed/active/resolved/escalated/expired) with notice period and max duration, and condition-based escrow enforcement',
  },
  {
    template: 'identity',
    functions: ['buildIdentityVerificationScript', 'buildDelegationProofScript', 'buildRotationScript', 'buildRevocationScript'],
    configTypes: ['IdentityVerificationConfig', 'DelegationProofConfig', 'RotationConfig', 'RevocationConfig'],
    package: 'identity',
    keywords: ['identity', 'verification', 'delegation', 'proof', 'key rotation', 'revocation', 'claim', 'did', 'public key'],
    description: 'Identity verification with claim hashing, delegation proofs with expiry, key rotation with delay, and revocation with epoch',
  },
  {
    template: 'liquidity-bond',
    functions: ['buildLiquidityLockScript', 'buildFeeAccrualScript', 'buildWithdrawalScript', 'buildPositionStateMachineScript'],
    configTypes: ['LiquidityLockConfig', 'PositionStateMachineConfig'],
    package: 'liquidity-bond',
    keywords: ['liquidity', 'bond', 'lock', 'unlock after block', 'cliff', 'fee accrual', 'pro rata', 'withdrawal', 'position', 'vesting', 'state machine'],
    description: 'Liquidity lock terms with status-gated cliffs, time-pro-rated fee accrual with VERIFYOUT to governance, bounded withdrawal count, and 5-active-status position FSM',
  },
  {
    template: 'lookup-protocol',
    functions: ['buildLeaseMessageScript', 'buildCoinUpdateScript', 'buildTrustMessageScript'],
    configTypes: ['LeaseMessageConfig', 'CoinUpdateConfig', 'TrustMessageConfig'],
    package: 'lookup-protocol',
    keywords: ['lease message', 'coin update', 'trust message', 'event type', 'new spent confirmed', 'expiry', 'state machine', 'lookup', 'p2p'],
    description: 'Lease message validation with temporal deadline, coin update event type state machine, and trust message validation with expiry window',
  },
  {
    template: 'manifest',
    functions: ['buildManifestBindingScript', 'buildCapabilityScript', 'buildManifestExpiryScript'],
    configTypes: ['ManifestBindingConfig', 'CapabilityConfig', 'ManifestExpiryConfig'],
    package: 'manifest',
    keywords: ['manifest', 'binding', 'capability', 'permission', 'expiry', 'subscription interval', 'signed at', 'publisher', 'app manifest'],
    description: 'Manifest-to-identity binding with SHA3 hash, capability permission enforcement, and manifest expiry with subscription interval rate-limit',
  },
  {
    template: 'proof',
    functions: ['buildProofAnchorScript', 'buildCapabilityProofScript', 'buildRevocationProofScript', 'buildProofDelegationScript'],
    configTypes: ['ProofConfig'],
    package: 'proof',
    keywords: ['proof', 'anchor', 'capability', 'revocation', 'delegation', 'confirm at', 'expires at', 'proof chain'],
    description: 'Proof anchoring with confirmed-at block, capability/revocation/delegation proof scripts with temporal expiry',
  },
  {
    template: 'provider-bond',
    functions: ['buildBondLockupScript', 'buildHeartbeatScript', 'buildBondStateMachineScript', 'buildChallengeScript', 'buildBondReleaseScript'],
    configTypes: ['ProviderBondConfig', 'BondStateMachineConfig', 'ChallengeConfig'],
    package: 'provider-bond',
    keywords: ['provider bond', 'stake', 'lockup', 'heartbeat', 'sla', 'bond release', 'unbonding', 'slashing', 'challenge deadline', 'state machine', 'challenge commit', 'file uphold dismiss'],
    description: 'Provider bond lockup with status-gated cliffs, heartbeat enforcement with PREVSTATE elapsed tracking, 7-status bond FSM, commit/file/uphold/dismiss challenge cycle with VERIFYOUT, and bond release with governance override',
  },
  {
    template: 'statechain',
    functions: ['buildStatechainScript', 'buildStatechainOwnerRotationScript'],
    configTypes: ['StateChainConfig'],
    package: 'statechain',
    keywords: ['statechain', 'owner rotation', 'state utxo', 'coinage reclaim', 'owner transfer', 'multisig state'],
    description: 'Statechain UTXO locking script with owner rotation via STATE(0), MULTISIG(2) path, and coinage-based unilateral reclaim',
  },
  {
    template: 'temporal',
    functions: ['buildLinearRelease', 'buildCliffRelease', 'buildDeadlineScript', 'buildWindowScript', 'buildRateLimitScript', 'buildDecayScript', 'buildTemporalScript', 'computeRelease'],
    configTypes: ['TemporalConfig'],
    package: null,
    keywords: ['temporal', 'linear release', 'vesting', 'cliff', 'deadline', 'window', 'rate limit', 'decay', 'hyperbolic', 'time lock', 'block arithmetic', 'release curve'],
    description: 'Six temporal release curves: linear (vestr), cliff (delayed start), deadline (must claim before), window (valid between blocks), rate-limit (max per period), decay (hyperbolic). Includes off-chain computeRelease mirror',
  },
  {
    template: 'txpow',
    functions: ['buildTxPoWValidationScript', 'buildMagicConstantsScript'],
    configTypes: ['TxPoWValidationConfig'],
    package: 'txpow',
    keywords: ['txpow', 'transaction validation', 'magic constants', 'max size', 'max ops', 'min work', 'protocol constants'],
    description: 'TxPoW validation scripts for max transaction size, max KISSVM ops, minimum work threshold, and magic protocol constant enforcement',
  },
  {
    template: 'wots-lease',
    functions: ['buildLeaseCertificateScript', 'buildWatermarkTrackingScript', 'buildLeaseStateMachineScript'],
    configTypes: ['LeaseCertificateConfig'],
    package: 'wots-lease',
    keywords: ['wots', 'lease', 'certificate', 'watermark', 'key lease', 'state machine', 'pending active expired', 'tree id', 'device id'],
    description: 'WOTS lease certificate validation with temporal expiry, monotonically advancing watermark tracking, and lease state machine with pending/active/expired transitions',
  },
  {
    template: 'commercial',
    functions: ['maasLayer', 'payPerUseLayer', 'featureLicenseLayer', 'warrantyLayer', 'escrowLayer', 'leasingLayer', 'telemetryLicenseLayer', 'carbonProgrammeLayer', 'usageBasedInsuranceLayer', 'vehicleToGridLayer'],
    configTypes: [],
    package: null,
    keywords: ['commercial', 'maas', 'pay per use', 'feature license', 'warranty', 'escrow', 'leasing', 'telemetry', 'carbon', 'insurance', 'v2g', 'monetization'],
    description: 'Commercial MAST policy layers for MaaS, pay-per-use, feature licensing, warranty, escrow, leasing, telemetry, carbon programmes, usage-based insurance, and vehicle-to-grid',
  },
  {
    template: 'compliance',
    functions: ['buildCompliancePipeline', 'buildStandardCompliancePipeline', 'buildSupplyChainPipeline'],
    configTypes: ['ComplianceStage', 'CompliancePipelineConfig'],
    package: null,
    keywords: ['compliance', 'pipeline', 'kyc', 'aml', 'sanctions', 'regulatory', 'supply chain compliance', 'audit'],
    description: 'Compliance pipeline builder for regulatory stages, KYC/AML checks, and supply chain compliance verification',
  },
  {
    template: 'data-privacy',
    functions: ['buildDataAccessConsentScript', 'buildGdprSubjectRequestScript', 'buildDataPortabilityScript', 'buildZkProofIntegrationScript', 'buildDataEscrowScript'],
    configTypes: [],
    package: null,
    keywords: ['data privacy', 'gdpr', 'consent', 'subject request', 'data portability', 'zk proof', 'escrow', 'personal data'],
    description: 'Data privacy scripts for GDPR consent management, subject access requests, data portability, zero-knowledge proof integration, and data escrow',
  },
  {
    template: 'device-lifecycle',
    functions: ['commissioningLayer', 'transferLayer', 'keyRotationLayer', 'recoveryLayer', 'decommissioningLayer', 'remoteSupportLayer', 'configurationProfileLayer', 'certificateIssuanceLayer'],
    configTypes: [],
    package: null,
    keywords: ['device lifecycle', 'commissioning', 'transfer', 'key rotation', 'recovery', 'decommissioning', 'remote support', 'config profile', 'certificate'],
    description: 'Device lifecycle MAST policy layers for commissioning, ownership transfer, key rotation, recovery, decommissioning, remote support, configuration profiles, and certificate issuance',
  },
  {
    template: 'energy',
    functions: ['buildRecTradingScript', 'buildMicrogridScript', 'buildP2PEnergyScript', 'buildDemandResponseScript', 'buildNetMeteringScript'],
    configTypes: [],
    package: null,
    keywords: ['energy', 'rec', 'renewable energy certificate', 'microgrid', 'p2p energy', 'demand response', 'net metering', 'smart grid'],
    description: 'Energy trading scripts for REC trading, microgrid management, peer-to-peer energy, demand response, and net metering',
  },
  {
    template: 'firmware-update',
    functions: ['buildFirmwareUpdateScript'],
    configTypes: ['FirmwareUpdateConfig'],
    package: null,
    keywords: ['firmware update', 'ota', 'over the air', 'signed update', 'version verification'],
    description: 'Secure firmware update script with signed update verification and version enforcement',
  },
  {
    template: 'healthcare',
    functions: ['buildMedicalDeviceRegulationScript', 'buildPatientConsentScript', 'buildClinicalTrialScript', 'buildPrescriptionScript', 'buildHealthDataAccessScript'],
    configTypes: [],
    package: null,
    keywords: ['healthcare', 'medical device', 'regulation', 'patient consent', 'clinical trial', 'prescription', 'health data', 'hipaa'],
    description: 'Healthcare scripts for medical device regulation compliance, patient consent management, clinical trial data, prescription verification, and health data access',
  },
  {
    template: 'layers',
    functions: ['assetLayer', 'manufacturerLayer', 'productLayer', 'regulatoryLayer', 'ownerLayer', 'siteLayer', 'operatorLayer', 'emergencyLayer'],
    configTypes: [],
    package: null,
    keywords: ['mast layer', 'policy layer', 'asset', 'manufacturer', 'product', 'regulatory', 'owner', 'site', 'operator', 'emergency', 'layered policy'],
    description: 'Standard 7-layer MAST policy chain: asset → manufacturer → product → regulatory → owner → site → operator, plus emergency override layer',
  },
  {
    template: 'legal',
    functions: ['buildDocumentNotarizationScript', 'buildTimestampVerificationScript', 'buildSmartContractExecutionScript', 'buildPowerOfAttorneyScript', 'buildMultiJurisdictionScript'],
    configTypes: [],
    package: null,
    keywords: ['legal', 'notarization', 'timestamp', 'smart contract', 'power of attorney', 'multi jurisdiction', 'document'],
    description: 'Legal scripts for document notarization, timestamp verification, smart contract execution, power of attorney, and multi-jurisdiction enforcement',
  },
  {
    template: 'payment-channel',
    functions: ['buildPaymentChannelScript', 'buildChannelFactoryScript'],
    configTypes: ['PaymentChannelConfig'],
    package: null,
    keywords: ['payment channel', 'channel factory', 'micro payment', 'state channel', 'off chain', 'layer 2'],
    description: 'Payment channel script with MAST-based state updates and channel factory for N-of-N funding with settlement paths',
  },
  {
    template: 'recovery',
    functions: ['buildThresholdRecoveryScript', 'buildEpochRotationScript', 'buildDelegatedCredentialScript', 'buildInstitutionalHierarchy', 'buildSuccessionScript'],
    configTypes: ['ThresholdRecoveryConfig', 'EpochRotationConfig', 'DelegatedCredentialConfig', 'InstitutionalHierarchyConfig', 'SuccessionConfig'],
    package: null,
    keywords: ['recovery', 'threshold', 'social recovery', 'epoch rotation', 'delegated credential', 'institutional hierarchy', 'succession', 'key recovery'],
    description: 'Key recovery scripts: threshold/social recovery, epoch-based key rotation, delegated credentials, institutional hierarchy, and succession planning',
  },
  {
    template: 'rwa-lifecycle',
    functions: ['buildAssetTokenizationScript', 'buildFractionalizationScript', 'buildAuditTrailScript', 'buildDistributionScript', 'buildShareTransferScript', 'buildRedemptionScript', 'buildAssetDisposalScript', 'buildRwaPolicyTree'],
    configTypes: [],
    package: null,
    keywords: ['rwa', 'real world asset', 'tokenization', 'fractionalization', 'audit trail', 'distribution', 'share transfer', 'redemption', 'disposal'],
    description: 'Real-world asset lifecycle scripts for tokenization, fractionalization, audit trails, distribution, share transfer, redemption, and asset disposal',
  },
  {
    template: 'sensor-proof',
    functions: ['buildSensorProofScript', 'buildSensorFleetPolicy', 'buildSensorProofChain'],
    configTypes: ['SensorProofConfig'],
    package: null,
    keywords: ['sensor', 'proof', 'iot', 'data proof', 'sensor fleet', 'proof chain', 'telemetry'],
    description: 'Sensor data proof scripts for individual sensor attestations, fleet-wide policies, and chained multi-sensor proofs',
  },
  {
    template: 'state-machine',
    functions: ['buildStateMachineScript', 'buildStateMachineWorkflow', 'onOffStateMachine', 'hvacStateMachine', 'productionStateMachine', 'robotArmStateMachine'],
    configTypes: ['StateMachineConfig'],
    package: null,
    keywords: ['state machine', 'workflow', 'on off', 'hvac', 'production', 'robot arm', 'iot state', 'device state'],
    description: 'Generic state machine template with predefined workflows for on/off devices, HVAC systems, production lines, and robot arms',
  },
  {
    template: 'supply-chain',
    functions: ['buildProvenanceScript', 'buildColdChainScript', 'buildBillOfLadingScript', 'buildCustomsClearanceScript', 'buildInventoryScript', 'buildQualityInspectionScript'],
    configTypes: [],
    package: null,
    keywords: ['supply chain', 'provenance', 'cold chain', 'bill of lading', 'customs clearance', 'inventory', 'quality inspection', 'logistics'],
    description: 'Supply chain scripts for provenance tracking, cold chain monitoring, bills of lading, customs clearance, inventory management, and quality inspection',
  },
  {
    template: 'treasury',
    functions: ['buildMultiSigTreasuryScript', 'buildBudgetAllocationScript', 'buildTimeLockedReserveScript', 'buildProposalExecutionScript', 'buildStreamingPaymentScript', 'buildTreasuryDelegationChain'],
    configTypes: [],
    package: null,
    keywords: ['treasury', 'multisig', 'budget', 'time lock', 'reserve', 'proposal execution', 'streaming payment', 'delegation chain', 'fund management'],
    description: 'Treasury management scripts for multi-sig control, budget allocation, time-locked reserves, proposal execution, streaming payments, and delegation chains',
  },
  {
    template: 'voting',
    functions: ['buildWeightedVotingScript', 'buildLiquidDemocracyScript', 'buildQuadraticVotingScript', 'buildElectionVerificationScript', 'buildDelegateRecallScript'],
    configTypes: [],
    package: null,
    keywords: ['voting', 'weighted', 'liquid democracy', 'quadratic', 'election', 'delegate recall', 'governance vote', 'ballot'],
    description: 'Voting scripts for weighted voting, liquid democracy delegation, quadratic voting, election verification, and delegate recall',
  },
  {
    template: 'recursive-mast-delegation',
    functions: ['buildDelegationLink', 'buildDelegationScript', 'buildDelegationChain', 'verifyDelegationChain', 'toDelegationChainScript'],
    configTypes: [],
    package: 'recursive-mast',
    keywords: ['delegation chain', 'delegation link', 'authority delegation', 'nested mast delegation', 'policy delegation', 'recursive mast'],
    description: 'Recursive MAST delegation chain builder — hierarchical authority delegation with proof-of-delegation via nested MAST. Builds on top of KISSVM policy-tree and proof-chain primitives',
  },
  {
    template: 'recursive-mast-cross-domain',
    functions: ['buildCrossDomainBridge', 'buildAcceptanceScript', 'buildBidirectionalBridge', 'buildTrustNetwork'],
    configTypes: [],
    package: 'recursive-mast',
    keywords: ['cross domain', 'trust bridge', 'inter policy', 'acceptance script', 'bidirectional bridge', 'trust network', 'domain trust'],
    description: 'Cross-domain trust bridge for inter-policy-space trust — enables policies in different domains to recognise and verify each other through acceptance scripts and bidirectional bridges',
  },
  {
    template: 'recursive-mast-migration',
    functions: ['buildMigrationStep', 'buildMigrationScript', 'buildMigrationPath', 'isMigrationActive', 'isMigrationComplete', 'getActivePolicyRoot', 'toMigrationPathScript'],
    configTypes: [],
    package: 'recursive-mast',
    keywords: ['migration path', 'policy migration', 'upgradeable policy', 'migration step', 'policy root rotation', 'version upgrade'],
    description: 'Policy migration path constructor — upgradeable policy systems with step-by-step migration scripts, active root tracking, and version transitions via the policy anchor coin',
  },
  {
    template: 'recursive-mast-signing',
    functions: ['createSigningRequest', 'createSigningResponse', 'collectSigningResponses', 'buildRecursiveWitnessPlan', 'verifySigningRequest'],
    configTypes: ['CreateSigningRequestConfig', 'CreateSigningResponseConfig', 'SigningRoundResult', 'PolicySigningRequest', 'PolicySigningResponse', 'ScriptDisclosure', 'SignedEvidence', 'PolicyPathDescriptor'],
    package: 'recursive-mast',
    keywords: ['signing request', 'signing response', 'witness plan', 'multi party signing', 'transaction signing', 'policy signing', 'collect signatures'],
    description: 'Policy signing request/response coordination — multi-party signing with recursive witness planning, script disclosure, and signed evidence collection for nested MAST transactions',
  },
  {
    template: 'recursive-mast-session',
    functions: ['createSigningSession', 'advanceSession', 'acceptResponse', 'recordEvidence', 'submitSession', 'confirmSession', 'cancelSession', 'sessionSummary'],
    configTypes: ['SigningSession', 'SigningSessionConfig', 'SigningSessionStatus', 'RequiredRoleState', 'EvidenceState'],
    package: 'recursive-mast',
    keywords: ['signing session', 'multi party', 'state machine', 'evidence collection', 'transaction coordination', 'signing round', 'session management'],
    description: 'Multi-party signing session state machine — manages the full lifecycle of a coordinated signing round: create, advance through required roles, accept responses, record evidence, submit, confirm, or cancel',
  },
  {
    template: 'recursive-mast-discovery',
    functions: ['announcePolicy', 'queryPolicies', 'resolvePolicyForSubject', 'watchPolicy'],
    configTypes: ['PolicyLookupClient', 'PolicyQueryResult', 'PolicyUpdateNotification', 'AnnouncePolicyConfig', 'QueryPolicyConfig', 'ResolvePolicyConfig', 'ResolvedPolicy', 'WatchPolicyConfig'],
    package: 'recursive-mast',
    keywords: ['policy discovery', 'announce', 'query', 'resolve', 'watch', 'policy lookup', 'service discovery', 'policy registry'],
    description: 'Policy discovery protocol — announce policies to a lookup client, query available policies, resolve policies for specific subjects, and watch for updates',
  },
  {
    template: 'recursive-mast-branch-capsule',
    functions: ['serializeBranchPackage', 'deserializeBranchPackage', 'verifyBranchPackage', 'createBranchPackage', 'branchSummary'],
    configTypes: ['MastBranchPackage', 'BranchFilter', 'MastBranchSummary'],
    package: 'recursive-mast',
    keywords: ['branch capsule', 'branch package', 'serialize', 'deserialize', 'verify branch', 'self contained', 'script proof package'],
    description: 'Branch capsule — self-contained MAST script+proof packages that can be serialised, verified, and transferred as a unit',
  },
  {
    template: 'recursive-mast-policy-manifest',
    functions: ['computePolicyPackageHash', 'signPolicyManifest', 'splitPolicyManifest'],
    configTypes: ['RecursiveMastPolicyManifest', 'PolicyAction', 'PolicyRole', 'PolicyEndpoint', 'RestrictedBranchPackage'],
    package: 'recursive-mast',
    keywords: ['policy manifest', 'policy metadata', 'signed policy', 'policy hash', 'policy split', 'discoverable policy'],
    description: 'Policy manifest — signed, discoverable policy metadata with package hashing, signing, and splitting for nested MAST governance structures',
  },
  {
    template: 'recursive-mast-store',
    functions: [],
    configTypes: ['RecursiveMastPolicyStore', 'MirrorResult', 'MemoryPolicyStore', 'MemoryStoreOptions', 'HttpPolicyStore', 'HttpStoreOptions'],
    package: 'recursive-mast',
    keywords: ['policy store', 'memory store', 'http store', 'storage', 'mirror', 'policy persistence', 'policy storage'],
    description: 'Policy store interface with in-memory and HTTP implementations — storage-agnostic persistence for policy trees, proofs, and manifests',
  },
  {
    template: 'recursive-mast-encrypted-branch',
    functions: ['createEncryptedBranch', 'decryptBranch', 'isEncryptedBranch', 'encryptedBranchPublicMetadata'],
    configTypes: ['EncryptedBranchPackage', 'DecryptedBranchResult'],
    package: 'recursive-mast',
    keywords: ['encrypted branch', 'private policy', 'decrypt', 'confidential', 'encrypted mast', 'private script'],
    description: 'Encrypted branch packages — private policy branches with public metadata, encryption, and decryption for confidential MAST structures',
  },
  {
    template: 'recursive-mast-inventory',
    functions: ['computeBranchInventoryHash', 'getCriticalBranches', 'getRecoveryBranches', 'getBranchesByAction', 'getBranchesByRole', 'validateInventoryCoverage'],
    configTypes: ['BranchInventory', 'BranchInventoryEntry'],
    package: 'recursive-mast',
    keywords: ['branch inventory', 'critical branches', 'recovery branches', 'inventory hash', 'coverage validation', 'branch audit'],
    description: 'Branch inventory management — compute inventory hashes, categorize branches by criticality, recovery, action, and role, and validate inventory coverage',
  },
  {
    template: 'recursive-mast-availability',
    functions: ['auditPolicyAvailability', 'createAvailabilityReceipt', 'signAvailabilityReceipt', 'verifyAvailabilityReceipt', 'receiptCoversBranch', 'receiptCoversInventory'],
    configTypes: ['AvailabilityPolicy', 'PolicyAvailabilityReport', 'AuditConfig', 'AvailabilityReceipt'],
    package: 'recursive-mast',
    keywords: ['availability audit', 'data availability', 'availability receipt', 'receipt verification', 'policy availability', 'availability report'],
    description: 'Policy availability auditing and receipts — audit which policies, proofs, and branches are available, issue signed availability receipts, and verify coverage',
  },
  {
    template: 'recursive-mast-content-keys',
    functions: ['policyManifestKey', 'scriptKey', 'proofKey', 'bundleKey', 'parseContentKey', 'computeBundleHash', 'computeScriptHash'],
    configTypes: ['ContentKey'],
    package: 'recursive-mast',
    keywords: ['content key', 'content addressed', 'key scheme', 'bundle hash', 'script hash', 'policy manifest key', 'content addressing'],
    description: 'Content-addressed key scheme for policy artifacts — deterministic key generation for manifests, scripts, proofs, and bundles using SHA3-256',
  },
]

const PACKAGE_TO_TEMPLATES: Record<string, TemplateEntry[]> = {}

for (const entry of TEMPLATE_CATALOG) {
  const pkgs = Array.isArray(entry.package) ? entry.package : entry.package ? [entry.package] : []
  for (const pkg of pkgs) {
    if (!PACKAGE_TO_TEMPLATES[pkg]) PACKAGE_TO_TEMPLATES[pkg] = []
    PACKAGE_TO_TEMPLATES[pkg].push(entry)
  }
}

export function getTemplatesForPackage(pkgName: string): TemplateEntry[] {
  return PACKAGE_TO_TEMPLATES[pkgName] || []
}

export function searchTemplates(query: string): TemplateEntry[] {
  const q = query.toLowerCase()
  const scored: Array<{ entry: TemplateEntry; score: number }> = []

  for (const entry of TEMPLATE_CATALOG) {
    let score = 0
    for (const kw of entry.keywords) {
      if (kw.includes(q) || q.includes(kw)) score += 3
    }
    for (const fn of entry.functions) {
      if (fn.toLowerCase().includes(q)) score += 2
    }
    if (entry.description.toLowerCase().includes(q)) score += 1
    if (entry.template.includes(q)) score += 2
    if (score > 0) scored.push({ entry, score })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map(s => s.entry)
}

export function getAllTemplates(): TemplateEntry[] {
  return TEMPLATE_CATALOG
}
