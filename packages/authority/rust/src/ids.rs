use sha3::{Digest, Sha3_256};

use crate::types::{ActionIntent, AuthorityUsageSnapshot, MandateBody};

const DOMAIN_INTENT: &str = "TOTEM_AUTHORITY_INTENT_V1";
const DOMAIN_MANDATE: &str = "TOTEM_AUTHORITY_MANDATE_V1";
const DOMAIN_DECISION: &str = "TOTEM_AUTHORITY_DECISION_V1";
const DOMAIN_USAGE: &str = "TOTEM_AUTHORITY_USAGE_V1";

fn domain_hash(domain: &str, value: &serde_json::Value) -> String {
    let input = format!("{}{}", domain, serde_json::to_string(value).unwrap_or_default());
    let mut hasher = Sha3_256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn compute_action_intent_id(intent: &ActionIntent) -> String {
    let payload = serde_json::json!({
        "action": intent.action,
        "principal": intent.principal,
        "agent": intent.agent,
        "target": intent.target,
        "constraints": intent.constraints,
    });
    format!("totem:intent:{}", domain_hash(DOMAIN_INTENT, &payload))
}

pub fn compute_mandate_id(mandate: &MandateBody) -> String {
    let payload = serde_json::json!(mandate);
    format!("totem:mandate:{}", domain_hash(DOMAIN_MANDATE, &payload))
}

pub fn compute_authority_decision_id(
    intent_id: &str,
    mandate_id: &str,
    mandate_verification_valid: bool,
    usage_snapshot_hash: &str,
    evidence_ids: &[String],
    evaluated_at: u64,
    policy_version: &str,
    final_status: &str,
    matched_rules: &[String],
    failed_rules: &[String],
) -> String {
    let mut sorted_evidence: Vec<String> = evidence_ids.to_vec();
    sorted_evidence.sort();
    let mut sorted_matched: Vec<String> = matched_rules.to_vec();
    sorted_matched.sort();
    let mut sorted_failed: Vec<String> = failed_rules.to_vec();
    sorted_failed.sort();

    let payload = serde_json::json!({
        "intentId": intent_id,
        "mandateId": mandate_id,
        "mandateVerificationValid": mandate_verification_valid,
        "usageSnapshotHash": usage_snapshot_hash,
        "evidenceIds": sorted_evidence,
        "evaluatedAt": evaluated_at,
        "policyVersion": policy_version,
        "finalStatus": final_status,
        "matchedRules": sorted_matched,
        "failedRules": sorted_failed,
    });
    format!("totem:decision:{}", domain_hash(DOMAIN_DECISION, &payload))
}

pub fn compute_usage_snapshot_hash(snapshot: &AuthorityUsageSnapshot) -> String {
    let payload = serde_json::json!(snapshot);
    domain_hash(DOMAIN_USAGE, &payload)
}
