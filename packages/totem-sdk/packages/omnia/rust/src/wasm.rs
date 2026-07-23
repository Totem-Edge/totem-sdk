use wasm_bindgen::prelude::*;

use crate::capacity;
use crate::commitment;
use crate::script;
use crate::types::*;
use crate::validation;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

// ─── script ──────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn build_eltoo_script_wasm(parties_js: JsValue) -> Result<String, JsValue> {
    let parties: Vec<ChannelParticipant> = serde_wasm_bindgen::from_value(parties_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse parties: {}", e)))?;
    script::build_eltoo_script(&parties)
        .map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn normalize_script_wasm(script_str: &str) -> String {
    script::normalize_script(script_str)
}

// ─── capacity ────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn assess_capacity_wasm(used: u32) -> Result<JsValue, JsValue> {
    match capacity::assess_capacity(used) {
        Ok(assessment) => serde_wasm_bindgen::to_value(&assessment)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn flat_signing_index_wasm(l1: u32, l2: u32) -> u32 {
    capacity::flat_signing_index(l1, l2)
}

#[wasm_bindgen]
pub fn get_wots_capacity_total_wasm() -> u32 {
    capacity::WOTS_CAPACITY_TOTAL
}

// ─── commitment ──────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn compute_state_commitment_wasm(
    sequence: u32,
    balances_js: JsValue,
    pending_htlcs_js: JsValue,
) -> Result<Vec<u8>, JsValue> {
    let balances: std::collections::HashMap<String, String> =
        serde_wasm_bindgen::from_value(balances_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse balances: {}", e)))?;
    let pending_htlcs: Vec<HTLCRecord> = serde_wasm_bindgen::from_value(pending_htlcs_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse HTLCs: {}", e)))?;
    Ok(commitment::compute_state_commitment(sequence, &balances, &pending_htlcs))
}

#[wasm_bindgen]
pub fn compute_tx_draft_digest_wasm(
    tx_type: &str,
    inputs_js: JsValue,
    outputs_js: JsValue,
    state_variables_js: JsValue,
) -> Result<Vec<u8>, JsValue> {
    let inputs: Vec<serde_json::Value> = serde_wasm_bindgen::from_value(inputs_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse inputs: {}", e)))?;
    let outputs: Vec<serde_json::Value> = serde_wasm_bindgen::from_value(outputs_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse outputs: {}", e)))?;
    let state_variables: Vec<serde_json::Value> = serde_wasm_bindgen::from_value(state_variables_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse stateVariables: {}", e)))?;
    Ok(commitment::compute_tx_draft_digest(tx_type, &inputs, &outputs, &state_variables))
}

// ─── validation ──────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn validate_balance_conservation_wasm(
    total_value: &str,
    balances_js: JsValue,
    pending_htlcs_js: JsValue,
) -> Result<JsValue, JsValue> {
    let balances: std::collections::HashMap<String, String> =
        serde_wasm_bindgen::from_value(balances_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse balances: {}", e)))?;
    let pending_htlcs: Vec<HTLCRecord> = serde_wasm_bindgen::from_value(pending_htlcs_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse HTLCs: {}", e)))?;
    let result = validation::validate_balance_conservation(total_value, &balances, &pending_htlcs);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn validate_complete_channel_state_wasm(
    channel_js: JsValue,
    state_js: JsValue,
) -> Result<JsValue, JsValue> {
    let channel: OmniaChannel = serde_wasm_bindgen::from_value(channel_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse channel: {}", e)))?;
    let state: SignedChannelState = serde_wasm_bindgen::from_value(state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse state: {}", e)))?;
    let result = validation::validate_complete_channel_state(&channel, &state);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn verify_state_wasm(
    channel_js: JsValue,
    state_js: JsValue,
    verify_sig_js: JsValue,
) -> Result<JsValue, JsValue> {
    let channel: OmniaChannel = serde_wasm_bindgen::from_value(channel_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse channel: {}", e)))?;
    let state: SignedChannelState = serde_wasm_bindgen::from_value(state_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse state: {}", e)))?;

    let verify_fn = js_sys::Function::from(verify_sig_js);
    let sig_verifier = move |sig: &str, commitment: &[u8], pkd: &str| -> bool {
        let this = JsValue::NULL;
        let args = js_sys::Array::new();
        args.push(&JsValue::from_str(sig));
        args.push(&JsValue::from_str(&hex::encode(commitment)));
        args.push(&JsValue::from_str(pkd));
        match verify_fn.call1(&this, &args) {
            Ok(result) => result.as_bool().unwrap_or(false),
            Err(_) => false,
        }
    };

    let result = validation::verify_state(&channel, &state, &sig_verifier);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn validate_state_transition_wasm(
    channel_js: JsValue,
    new_sequence: u32,
    new_balances_js: JsValue,
    pending_htlc_delta: &str,
) -> Result<JsValue, JsValue> {
    let channel: OmniaChannel = serde_wasm_bindgen::from_value(channel_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse channel: {}", e)))?;
    let new_balances: std::collections::HashMap<String, String> =
        serde_wasm_bindgen::from_value(new_balances_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse balances: {}", e)))?;
    match validation::validate_state_transition(&channel, new_sequence, &new_balances, pending_htlc_delta) {
        Ok(()) => Ok(JsValue::from_bool(true)),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn verify_htlc_preimage_wasm(preimage: &str, hashlock: &str) -> bool {
    validation::verify_htlc_preimage(preimage, hashlock)
}
