use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionIntent {
    pub action: String,
    pub principal: String,
    pub agent: String,
    pub target: Option<String>,
    pub constraints: Option<HashMap<String, serde_json::Value>>,
    pub nonce: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MandateBody {
    pub grantor: String,
    pub grantee: String,
    pub principal: String,
    pub scope: String,
    pub constraints: Option<Vec<MandateConstraint>>,
    #[serde(rename = "usageLimit")]
    pub usage_limit: Option<UsageLimit>,
    #[serde(rename = "issuedAt")]
    pub issued_at: u64,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<u64>,
    #[serde(rename = "revocationEpoch")]
    pub revocation_epoch: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MandateConstraint {
    pub field: String,
    pub operator: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageLimit {
    #[serde(rename = "maxCount")]
    pub max_count: Option<u32>,
    #[serde(rename = "maxTotal")]
    pub max_total: Option<String>,
    #[serde(rename = "windowMs")]
    pub window_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorityUsage {
    #[serde(rename = "usageId")]
    pub usage_id: String,
    #[serde(rename = "mandateProofId")]
    pub mandate_proof_id: String,
    #[serde(rename = "intentId")]
    pub intent_id: String,
    #[serde(rename = "usedAt")]
    pub used_at: u64,
    #[serde(rename = "countsToward")]
    pub counts_toward: Option<UsageCounts>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageCounts {
    pub count: Option<u32>,
    pub amount: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorityUsageSnapshot {
    #[serde(rename = "mandateProofId")]
    pub mandate_proof_id: String,
    #[serde(rename = "totalCount")]
    pub total_count: u32,
    #[serde(rename = "totalAmount")]
    pub total_amount: Option<String>,
    #[serde(rename = "windowStart")]
    pub window_start: Option<u64>,
    #[serde(rename = "windowEnd")]
    pub window_end: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MandateVerificationResult {
    pub valid: bool,
    pub reason: Option<String>,
    #[serde(rename = "mandateId")]
    pub mandate_id: Option<String>,
    #[serde(rename = "grantorAddress")]
    pub grantor_address: Option<String>,
    #[serde(rename = "granteeAddress")]
    pub grantee_address: Option<String>,
    #[serde(rename = "principalId")]
    pub principal_id: Option<String>,
    #[serde(rename = "identityVerified")]
    pub identity_verified: bool,
    #[serde(rename = "scopeMatch")]
    pub scope_match: bool,
    #[serde(rename = "usageExceeded")]
    pub usage_exceeded: bool,
    pub expired: bool,
    #[serde(rename = "identityRevoked")]
    pub identity_revoked: bool,
    #[serde(rename = "mandateRevoked")]
    pub mandate_revoked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorityDecision {
    pub allowed: bool,
    pub reason: Option<String>,
    #[serde(rename = "matchedRules")]
    pub matched_rules: Vec<String>,
    #[serde(rename = "failedRules")]
    pub failed_rules: Vec<String>,
    #[serde(rename = "intentId")]
    pub intent_id: String,
    #[serde(rename = "mandateId")]
    pub mandate_id: String,
    #[serde(rename = "decisionId")]
    pub decision_id: String,
    #[serde(rename = "evaluatedAt")]
    pub evaluated_at: u64,
    #[serde(rename = "policyVersion")]
    pub policy_version: String,
    #[serde(rename = "mandateVerification")]
    pub mandate_verification: MandateVerificationResult,
    #[serde(rename = "usageSnapshot")]
    pub usage_snapshot: AuthorityUsageSnapshot,
    #[serde(rename = "usageSnapshotHash")]
    pub usage_snapshot_hash: String,
    #[serde(rename = "evidenceIds")]
    pub evidence_ids: Vec<String>,
    #[serde(rename = "usageDelta")]
    pub usage_delta: Option<UsageDelta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageDelta {
    pub count: u32,
    pub amount: Option<String>,
}
