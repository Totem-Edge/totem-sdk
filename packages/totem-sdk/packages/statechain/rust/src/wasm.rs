use wasm_bindgen::prelude::*;

use crate::commitment;
use crate::script;
use crate::types::*;
use crate::verify;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

// ─── script ──────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn build_statechain_script_wasm(se_pkd: &str) -> String {
    script::build_statechain_script(se_pkd)
}

#[wasm_bindgen]
pub fn normalize_script_wasm(script_str: &str) -> String {
    script::normalize_script(script_str)
}

#[wasm_bindgen]
pub fn get_reclaim_timelock_wasm() -> u64 {
    script::RECLAIM_TIMELOCK
}

// ─── commitment ──────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn compute_transfer_commitment_wasm(
    chain_id: &str,
    from: &str,
    to: &str,
    sequence: u32,
    timestamp: u64,
) -> Vec<u8> {
    commitment::compute_transfer_commitment(chain_id, from, to, sequence, timestamp)
}

#[wasm_bindgen]
pub fn compute_reclaim_commitment_wasm(
    coin_id: &str,
    owner_pkd: &str,
    locking_address: &str,
) -> Vec<u8> {
    commitment::compute_reclaim_commitment(coin_id, owner_pkd, locking_address)
}

// ─── verify ──────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn verify_state_chain_wasm(
    chain_js: JsValue,
    verify_blind_sig_js: JsValue,
    verify_owner_sig_js: JsValue,
    verify_transfer_key_js: JsValue,
) -> Result<JsValue, JsValue> {
    let chain: StateChain = serde_wasm_bindgen::from_value(chain_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse chain: {}", e)))?;

    let verify_blind_sig = js_sys::Function::from(verify_blind_sig_js);
    let verify_owner_sig = js_sys::Function::from(verify_owner_sig_js);
    let verify_transfer_key = js_sys::Function::from(verify_transfer_key_js);

    let blind_sig_fn = move |sig: &str, commitment: &[u8], se_pkd: &str| -> bool {
        let this = JsValue::NULL;
        let args = js_sys::Array::new();
        args.push(&JsValue::from_str(sig));
        args.push(&JsValue::from_str(&hex::encode(commitment)));
        args.push(&JsValue::from_str(se_pkd));
        match verify_blind_sig.call1(&this, &args) {
            Ok(result) => result.as_bool().unwrap_or(false),
            Err(_) => false,
        }
    };

    let owner_sig_fn = move |sig: &str, commitment: &[u8], from_pkd: &str| -> bool {
        let this = JsValue::NULL;
        let args = js_sys::Array::new();
        args.push(&JsValue::from_str(sig));
        args.push(&JsValue::from_str(&hex::encode(commitment)));
        args.push(&JsValue::from_str(from_pkd));
        match verify_owner_sig.call1(&this, &args) {
            Ok(result) => result.as_bool().unwrap_or(false),
            Err(_) => false,
        }
    };

    let transfer_key_fn = move |transfer_key: &str, from_pkd: &str| -> bool {
        let this = JsValue::NULL;
        let args = js_sys::Array::new();
        args.push(&JsValue::from_str(transfer_key));
        args.push(&JsValue::from_str(from_pkd));
        match verify_transfer_key.call1(&this, &args) {
            Ok(result) => result.as_bool().unwrap_or(false),
            Err(_) => false,
        }
    };

    let result = verify::verify_state_chain(&chain, &blind_sig_fn, &owner_sig_fn, &transfer_key_fn);

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}
