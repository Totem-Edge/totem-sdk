use wasm_bindgen::prelude::*;

use crate::ids;
use crate::scope;
use crate::types::*;
use crate::usage;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

// ─── ids ─────────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn compute_action_intent_id_wasm(intent_js: JsValue) -> Result<String, JsValue> {
    let intent: ActionIntent = serde_wasm_bindgen::from_value(intent_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse intent: {}", e)))?;
    Ok(ids::compute_action_intent_id(&intent))
}

#[wasm_bindgen]
pub fn compute_mandate_id_wasm(mandate_js: JsValue) -> Result<String, JsValue> {
    let mandate: MandateBody = serde_wasm_bindgen::from_value(mandate_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse mandate: {}", e)))?;
    Ok(ids::compute_mandate_id(&mandate))
}

#[wasm_bindgen]
pub fn compute_authority_decision_id_wasm(
    intent_id: &str,
    mandate_id: &str,
    mandate_verification_valid: bool,
    usage_snapshot_hash: &str,
    evidence_ids_js: JsValue,
    evaluated_at: u64,
    policy_version: &str,
    final_status: &str,
    matched_rules_js: JsValue,
    failed_rules_js: JsValue,
) -> Result<String, JsValue> {
    let evidence_ids: Vec<String> = serde_wasm_bindgen::from_value(evidence_ids_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse evidenceIds: {}", e)))?;
    let matched_rules: Vec<String> = serde_wasm_bindgen::from_value(matched_rules_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse matchedRules: {}", e)))?;
    let failed_rules: Vec<String> = serde_wasm_bindgen::from_value(failed_rules_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse failedRules: {}", e)))?;
    Ok(ids::compute_authority_decision_id(
        intent_id, mandate_id, mandate_verification_valid, usage_snapshot_hash,
        &evidence_ids, evaluated_at, policy_version, final_status,
        &matched_rules, &failed_rules,
    ))
}

#[wasm_bindgen]
pub fn compute_usage_snapshot_hash_wasm(snapshot_js: JsValue) -> Result<String, JsValue> {
    let snapshot: AuthorityUsageSnapshot = serde_wasm_bindgen::from_value(snapshot_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse snapshot: {}", e)))?;
    Ok(ids::compute_usage_snapshot_hash(&snapshot))
}

// ─── scope ──────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn match_scope_wasm(action: &str, scope: &str) -> bool {
    scope::match_scope(action, scope)
}

#[wasm_bindgen]
pub fn match_constraints_wasm(intent_js: JsValue, constraints_js: JsValue) -> Result<bool, JsValue> {
    let intent: ActionIntent = serde_wasm_bindgen::from_value(intent_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse intent: {}", e)))?;
    let constraints: Vec<MandateConstraint> = serde_wasm_bindgen::from_value(constraints_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse constraints: {}", e)))?;
    Ok(scope::match_constraints(&intent, &constraints))
}

// ─── usage ───────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn check_usage_limit_wasm(
    snapshot_js: JsValue,
    limit_js: JsValue,
    now: u64,
    proposed_count: Option<u32>,
    proposed_amount: Option<String>,
) -> Result<bool, JsValue> {
    let snapshot: AuthorityUsageSnapshot = serde_wasm_bindgen::from_value(snapshot_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse snapshot: {}", e)))?;
    let limit: UsageLimit = serde_wasm_bindgen::from_value(limit_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse limit: {}", e)))?;
    Ok(usage::check_usage_limit(&snapshot, &limit, now, proposed_count, proposed_amount.as_deref()))
}

#[wasm_bindgen]
pub fn calculate_usage_delta_wasm(intent_js: JsValue) -> Result<JsValue, JsValue> {
    let intent: ActionIntent = serde_wasm_bindgen::from_value(intent_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse intent: {}", e)))?;
    let (count, amount) = usage::calculate_usage_delta(&intent);
    let delta = serde_json::json!({ "count": count, "amount": amount });
    serde_wasm_bindgen::to_value(&delta)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn compute_usage_root_wasm(receipts_js: JsValue) -> Result<String, JsValue> {
    let receipts: Vec<AuthorityUsage> = serde_wasm_bindgen::from_value(receipts_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse receipts: {}", e)))?;
    Ok(usage::compute_usage_root(&receipts))
}

#[wasm_bindgen]
pub fn snapshot_from_usage_wasm(
    usages_js: JsValue,
    now: u64,
    limit_js: Option<JsValue>,
) -> Result<JsValue, JsValue> {
    let usages: Vec<AuthorityUsage> = serde_wasm_bindgen::from_value(usages_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse usages: {}", e)))?;
    let limit: Option<UsageLimit> = match limit_js {
        Some(js) => Some(serde_wasm_bindgen::from_value(js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse limit: {}", e)))?),
        None => None,
    };
    let snapshot = usage::snapshot_from_usage(&usages, now, limit.as_ref());
    serde_wasm_bindgen::to_value(&snapshot)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}
