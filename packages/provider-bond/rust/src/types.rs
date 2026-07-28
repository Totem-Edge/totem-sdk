use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderBondAssetDeclaration {
    #[serde(rename = "bondId")]
    pub bond_id: String,
    pub asset: String,
    pub amount: String,
    pub purpose: String,
    #[serde(rename = "lockType")]
    pub lock_type: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderBondExtension {
    #[serde(rename = "providerId")]
    pub provider_id: String,
    #[serde(rename = "bondOwnerAddress")]
    pub bond_owner_address: Option<String>,
    #[serde(rename = "bondStack")]
    pub bond_stack: Option<Vec<ProviderBondAssetDeclaration>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderBondManifest {
    #[serde(rename = "edgeServiceManifestId")]
    pub edge_service_manifest_id: String,
    #[serde(rename = "providerBond")]
    pub provider_bond: ProviderBondExtension,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProbeResult {
    #[serde(rename = "probeId")]
    pub probe_id: String,
    #[serde(rename = "providerId")]
    pub provider_id: String,
    #[serde(rename = "type")]
    pub probe_type: String,
    pub ok: bool,
    #[serde(rename = "latencyMs")]
    pub latency_ms: Option<u64>,
    #[serde(rename = "observedAt")]
    pub observed_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncidentRecord {
    #[serde(rename = "incidentId")]
    pub incident_id: String,
    #[serde(rename = "providerId")]
    pub provider_id: String,
    #[serde(rename = "type")]
    pub incident_type: String,
    pub severity: String,
    pub status: String,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderScore {
    #[serde(rename = "providerId")]
    pub provider_id: String,
    pub score: u32,
    pub recommendation: String,
    #[serde(rename = "bondScore")]
    pub bond_score: u32,
    #[serde(rename = "identityScore")]
    pub identity_score: u32,
    #[serde(rename = "reliabilityScore")]
    pub reliability_score: u32,
    #[serde(rename = "incidentScore")]
    pub incident_score: u32,
    #[serde(rename = "computedAt")]
    pub computed_at: u64,
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPolicy {
    #[serde(rename = "serviceType")]
    pub service_type: Option<String>,
    #[serde(rename = "minScore")]
    pub min_score: Option<u32>,
    #[serde(rename = "requireIdentity")]
    pub require_identity: Option<bool>,
    #[serde(rename = "requireActiveBond")]
    pub require_active_bond: Option<bool>,
    #[serde(rename = "requireMinimaHardCollateral")]
    pub require_minima_hard_collateral: Option<bool>,
    #[serde(rename = "minBondAmount")]
    pub min_bond_amount: Option<String>,
    #[serde(rename = "acceptedAssets")]
    pub accepted_assets: Option<Vec<String>>,
    #[serde(rename = "acceptedPurposes")]
    pub accepted_purposes: Option<Vec<String>>,
    #[serde(rename = "maxIncidentSeverity")]
    pub max_incident_severity: Option<String>,
    #[serde(rename = "maxHeartbeatAgeMs")]
    pub max_heartbeat_age_ms: Option<u64>,
    pub now: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyMatch {
    #[serde(rename = "providerId")]
    pub provider_id: String,
    pub matched: bool,
    pub reasons: Vec<String>,
    pub failures: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoringWeights {
    pub identity: f64,
    pub bond: f64,
    pub reliability: f64,
    pub incidents: f64,
}
