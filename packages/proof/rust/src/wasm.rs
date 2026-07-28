use wasm_bindgen::prelude::*;

use crate::anchor;
use crate::canonical;
use crate::types::*;
use crate::verify;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

// ─── canonical ───────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn to_hex_wasm(bytes: &[u8]) -> String {
    canonical::to_hex(bytes)
}

#[wasm_bindgen]
pub fn canonical_json_wasm(value_js: JsValue) -> Result<String, JsValue> {
    let v: serde_json::Value = serde_wasm_bindgen::from_value(value_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse value: {}", e)))?;
    Ok(canonical::canonical_json(&v))
}

#[wasm_bindgen]
pub fn compute_proof_id_wasm(input_js: JsValue) -> Result<String, JsValue> {
    let input: serde_json::Value = serde_wasm_bindgen::from_value(input_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse input: {}", e)))?;
    Ok(canonical::compute_proof_id(&input))
}

#[wasm_bindgen]
pub fn hash_proof_payload_wasm(unsigned_proof_js: JsValue) -> Result<String, JsValue> {
    let up: UnsignedProof = serde_wasm_bindgen::from_value(unsigned_proof_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse proof: {}", e)))?;
    Ok(canonical::hash_proof_payload(&up))
}

#[wasm_bindgen]
pub fn hash_evidence_wasm(evidence_js: JsValue) -> Result<String, JsValue> {
    let ev: EvidenceRef = serde_wasm_bindgen::from_value(evidence_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse evidence: {}", e)))?;
    Ok(canonical::hash_evidence(&ev))
}

// ─── anchor ──────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn create_anchor_commitment_wasm(signed_proof_js: JsValue) -> Result<String, JsValue> {
    let sp: SignedProof = serde_wasm_bindgen::from_value(signed_proof_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse proof: {}", e)))?;
    Ok(anchor::create_anchor_commitment(&sp))
}

#[wasm_bindgen]
pub fn verify_anchor_ref_wasm(signed_proof_js: JsValue, anchor_hash: &str) -> Result<bool, JsValue> {
    let sp: SignedProof = serde_wasm_bindgen::from_value(signed_proof_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse proof: {}", e)))?;
    Ok(anchor::verify_anchor_ref(&sp, anchor_hash))
}

// ─── verify ──────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn verify_proof_id_integrity_wasm(signed_proof_js: JsValue) -> Result<bool, JsValue> {
    let sp: SignedProof = serde_wasm_bindgen::from_value(signed_proof_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse proof: {}", e)))?;
    Ok(verify::verify_proof_id_integrity(&sp))
}

#[wasm_bindgen]
pub fn verify_proof_payload_wasm(
    signed_proof_js: JsValue,
    grace_ms: u64,
    now: u64,
) -> Result<bool, JsValue> {
    let sp: SignedProof = serde_wasm_bindgen::from_value(signed_proof_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse proof: {}", e)))?;
    Ok(verify::verify_proof_payload(&sp, grace_ms, now))
}

#[wasm_bindgen]
pub fn verify_proof_wasm(
    signed_proof_js: JsValue,
    verify_sig_js: JsValue,
    grace_ms: u64,
    now: u64,
) -> Result<JsValue, JsValue> {
    let sp: SignedProof = serde_wasm_bindgen::from_value(signed_proof_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse proof: {}", e)))?;

    let verify_fn = js_sys::Function::from(verify_sig_js);
    let sig_verifier = move |sig: &str, digest: &[u8], pkd: &str| -> bool {
        let this = JsValue::NULL;
        let args = js_sys::Array::new();
        args.push(&JsValue::from_str(sig));
        args.push(&JsValue::from_str(&hex::encode(digest)));
        args.push(&JsValue::from_str(pkd));
        match verify_fn.call1(&this, &args) {
            Ok(result) => result.as_bool().unwrap_or(false),
            Err(_) => false,
        }
    };

    let result = verify::verify_proof(&sp, &sig_verifier, grace_ms, now);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}
