use wasm_bindgen::prelude::*;

use crate::policy;
use crate::risk;
use crate::types::*;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn apply_liquidity_haircut_wasm(amount: &str, haircut_bps: Option<u32>) -> String {
    risk::apply_liquidity_haircut(amount, haircut_bps)
}

#[wasm_bindgen]
pub fn compute_position_risk_score_wasm(position_js: JsValue, now: u64) -> Result<JsValue, JsValue> {
    let position: LiquidityPosition = serde_wasm_bindgen::from_value(position_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    let score = risk::compute_position_risk_score(&position, now);
    serde_wasm_bindgen::to_value(&score)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn compute_pool_utilisation_wasm(total_allocated: &str, total_capacity: &str) -> Result<JsValue, JsValue> {
    let util = risk::compute_pool_utilisation(total_allocated, total_capacity);
    serde_wasm_bindgen::to_value(&util)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn detect_double_counted_liquidity_wasm(positions_js: JsValue) -> Result<JsValue, JsValue> {
    let positions: Vec<LiquidityPosition> = serde_wasm_bindgen::from_value(positions_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    let warnings = risk::detect_double_counted_liquidity(&positions);
    serde_wasm_bindgen::to_value(&warnings)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn sum_fees_for_position_wasm(records_js: JsValue, position_id: &str) -> Result<String, JsValue> {
    let records: Vec<LiquidityFeeRecord> = serde_wasm_bindgen::from_value(records_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    Ok(risk::sum_fees_for_position(&records, position_id))
}

#[wasm_bindgen]
pub fn validate_liquidity_against_policy_wasm(
    position_js: JsValue,
    policy_js: JsValue,
) -> Result<JsValue, JsValue> {
    let position: LiquidityPosition = serde_wasm_bindgen::from_value(position_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    let policy: LiquidityRiskPolicy = serde_wasm_bindgen::from_value(policy_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    let result = policy::validate_liquidity_against_policy(&position, &policy);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}
