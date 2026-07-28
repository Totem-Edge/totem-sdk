use wasm_bindgen::prelude::*;

use crate::policy;
use crate::scoring;
use crate::types::*;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn compute_provider_score_wasm(
    provider_js: JsValue,
    probes_js: JsValue,
    incidents_js: JsValue,
    now: u64,
    weights_js: JsValue,
) -> Result<JsValue, JsValue> {
    let provider: ProviderBondManifest = serde_wasm_bindgen::from_value(provider_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse provider: {}", e)))?;
    let probes: Vec<ProbeResult> = serde_wasm_bindgen::from_value(probes_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse probes: {}", e)))?;
    let incidents: Vec<IncidentRecord> = serde_wasm_bindgen::from_value(incidents_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse incidents: {}", e)))?;
    let weights: ScoringWeights = serde_wasm_bindgen::from_value(weights_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse weights: {}", e)))?;

    let score = scoring::compute_provider_score(&provider, &probes, &incidents, now, &weights);
    serde_wasm_bindgen::to_value(&score)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn compute_recommendation_wasm(score: u32) -> String {
    scoring::compute_recommendation(score)
}

#[wasm_bindgen]
pub fn filter_providers_by_policy_wasm(
    provider_js: JsValue,
    policy_js: JsValue,
    score_js: Option<JsValue>,
    probes_js: JsValue,
    incidents_js: JsValue,
) -> Result<JsValue, JsValue> {
    let provider: ProviderBondManifest = serde_wasm_bindgen::from_value(provider_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse provider: {}", e)))?;
    let policy: ProviderPolicy = serde_wasm_bindgen::from_value(policy_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse policy: {}", e)))?;
    let score: Option<ProviderScore> = match score_js {
        Some(js) => Some(serde_wasm_bindgen::from_value(js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse score: {}", e)))?),
        None => None,
    };
    let probes: Vec<ProbeResult> = serde_wasm_bindgen::from_value(probes_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse probes: {}", e)))?;
    let incidents: Vec<IncidentRecord> = serde_wasm_bindgen::from_value(incidents_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse incidents: {}", e)))?;

    let result = policy::filter_providers_by_policy(&provider, &policy, score.as_ref(), &probes, &incidents);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}
