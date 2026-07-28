use wasm_bindgen::prelude::*;

use crate::device;
use crate::types::*;
use crate::watermark;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn flat_index_wasm(address_index: u32, l1: u32, l2: u32) -> u32 {
    watermark::flat_index(&SigningIndices { address_index, l1, l2 })
}

#[wasm_bindgen]
pub fn from_flat_index_wasm(flat: u32) -> Result<JsValue, JsValue> {
    let indices = watermark::from_flat_index(flat);
    serde_wasm_bindgen::to_value(&indices)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn get_next_indices_wasm(state_js: JsValue, tree_id: &str) -> Result<JsValue, JsValue> {
    let state: WotsWatermarkState = serde_wasm_bindgen::from_value(state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse state: {}", e)))?;
    match watermark::get_next_indices(&state, tree_id) {
        Ok(indices) => serde_wasm_bindgen::to_value(&indices)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn mark_unavailable_wasm(
    state_js: JsValue,
    tree_id: &str,
    indices_js: JsValue,
    reason: &str,
) -> Result<JsValue, JsValue> {
    let mut state: WotsWatermarkState = serde_wasm_bindgen::from_value(state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse state: {}", e)))?;
    let indices: SigningIndices = serde_wasm_bindgen::from_value(indices_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse indices: {}", e)))?;
    watermark::mark_unavailable(&mut state, tree_id, &indices, reason);
    serde_wasm_bindgen::to_value(&state)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn is_unavailable_wasm(
    state_js: JsValue,
    tree_id: &str,
    indices_js: JsValue,
) -> Result<bool, JsValue> {
    let state: WotsWatermarkState = serde_wasm_bindgen::from_value(state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse state: {}", e)))?;
    let indices: SigningIndices = serde_wasm_bindgen::from_value(indices_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse indices: {}", e)))?;
    Ok(watermark::is_unavailable(&state, tree_id, &indices))
}

#[wasm_bindgen]
pub fn get_local_watermark_wasm(state_js: JsValue, tree_id: &str) -> Result<JsValue, JsValue> {
    let state: WotsWatermarkState = serde_wasm_bindgen::from_value(state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse state: {}", e)))?;
    let lw = watermark::get_local_watermark(&state, tree_id);
    serde_wasm_bindgen::to_value(&lw)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn new_watermark_state_wasm() -> Result<JsValue, JsValue> {
    let state = watermark::new_state();
    serde_wasm_bindgen::to_value(&state)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn get_capacity_per_tree_wasm() -> u32 {
    watermark::CAPACITY_PER_TREE
}

#[wasm_bindgen]
pub fn allocate_device_range_wasm(device_slot: u32, device_id: &str) -> Result<JsValue, JsValue> {
    match device::allocate_device_range(device_slot, device_id) {
        Ok(range) => serde_wasm_bindgen::to_value(&range)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn device_slot_for_address_index_wasm(address_index: u32) -> u32 {
    device::device_slot_for_address_index(address_index)
}
