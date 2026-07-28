use wasm_bindgen::prelude::*;
use std::collections::HashMap;

use crate::commitment;
use crate::types::*;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn compute_splice_tx_digest_wasm(draft_js: JsValue) -> Result<Vec<u8>, JsValue> {
    let draft: SpliceTxDraft = serde_wasm_bindgen::from_value(draft_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    Ok(commitment::compute_splice_tx_digest(&draft))
}

#[wasm_bindgen]
pub fn scale_balances_wasm(
    balances_js: JsValue,
    old_total: &str,
    new_total: &str,
) -> Result<JsValue, JsValue> {
    let balances: HashMap<String, String> = serde_wasm_bindgen::from_value(balances_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    match commitment::scale_balances(&balances, old_total, new_total) {
        Ok(result) => serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn validate_splice_params_wasm(
    total_value: &str,
    params_js: JsValue,
) -> Result<JsValue, JsValue> {
    let params: SpliceParams = serde_wasm_bindgen::from_value(params_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    let result = commitment::validate_splice_params(total_value, &params);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}
