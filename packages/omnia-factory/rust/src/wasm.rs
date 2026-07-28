use wasm_bindgen::prelude::*;
use std::collections::HashMap;

use crate::commitment;
use crate::script;
use crate::types::*;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn build_factory_script_wasm(participants_js: JsValue) -> Result<String, JsValue> {
    let participants: Vec<FactoryParticipant> = serde_wasm_bindgen::from_value(participants_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    script::build_factory_script(&participants).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn normalize_script_wasm(script_str: &str) -> String {
    script::normalize_script(script_str)
}

#[wasm_bindgen]
pub fn compute_factory_state_commitment_wasm(
    factory_id: &str,
    sequence: u32,
    allocations_js: JsValue,
    virtual_channel_ids_js: JsValue,
) -> Result<Vec<u8>, JsValue> {
    let allocations: HashMap<String, String> = serde_wasm_bindgen::from_value(allocations_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse allocations: {}", e)))?;
    let vc_ids: Vec<String> = serde_wasm_bindgen::from_value(virtual_channel_ids_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse vcIds: {}", e)))?;
    Ok(commitment::compute_factory_state_commitment(factory_id, sequence, &allocations, &vc_ids))
}

#[wasm_bindgen]
pub fn enforce_conservation_wasm(
    total_value: &str,
    allocations_js: JsValue,
    virtual_channel_total: &str,
) -> Result<JsValue, JsValue> {
    let allocations: HashMap<String, String> = serde_wasm_bindgen::from_value(allocations_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse allocations: {}", e)))?;
    match commitment::enforce_conservation(total_value, &allocations, virtual_channel_total) {
        Ok(()) => Ok(JsValue::from_bool(true)),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}
