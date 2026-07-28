use wasm_bindgen::prelude::*;

use crate::canonical;
use crate::claims;
use crate::id;
use crate::types::*;
use crate::verify;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn to_hex_wasm(bytes: &[u8]) -> String {
    canonical::to_hex(bytes)
}

#[wasm_bindgen]
pub fn canonical_json_wasm(value_js: JsValue) -> Result<String, JsValue> {
    let v: serde_json::Value = serde_wasm_bindgen::from_value(value_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    Ok(canonical::canonical_json(&v))
}

#[wasm_bindgen]
pub fn claim_digest_wasm(claim_js: JsValue) -> Result<Vec<u8>, JsValue> {
    let c: serde_json::Value = serde_wasm_bindgen::from_value(claim_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    Ok(canonical::claim_digest(&c))
}

#[wasm_bindgen]
pub fn compute_identity_id_wasm(kind: &str, root_address: &str) -> String {
    id::compute_identity_id(kind, root_address)
}

#[wasm_bindgen]
pub fn compute_claim_id_wasm(
    claim_type: &str,
    issuer: &str,
    subject: &str,
    object: &str,
    issued_at: u64,
    payload_js: Option<JsValue>,
) -> Result<String, JsValue> {
    let payload: Option<serde_json::Value> = match payload_js {
        Some(js) => Some(serde_wasm_bindgen::from_value(js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse payload: {}", e)))?),
        None => None,
    };
    Ok(id::compute_claim_id(claim_type, issuer, subject, object, issued_at, payload.as_ref()))
}

#[wasm_bindgen]
pub fn create_identity_claim_wasm(
    claim_type: &str,
    issuer: &str,
    subject: &str,
    object: &str,
    issued_at: u64,
    expires_at: Option<u64>,
    payload_js: Option<JsValue>,
) -> Result<JsValue, JsValue> {
    let payload: Option<serde_json::Value> = match payload_js {
        Some(js) => Some(serde_wasm_bindgen::from_value(js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse payload: {}", e)))?),
        None => None,
    };
    let claim = claims::create_identity_claim(claim_type, issuer, subject, object, issued_at, expires_at, payload);
    serde_wasm_bindgen::to_value(&claim)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn create_delegation_claim_wasm(
    issuer: &str,
    subject: &str,
    delegate_address: &str,
    scopes_js: JsValue,
    issued_at: u64,
    expires_at: Option<u64>,
) -> Result<JsValue, JsValue> {
    let scopes: Vec<String> = serde_wasm_bindgen::from_value(scopes_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse scopes: {}", e)))?;
    let claim = claims::create_delegation_claim(issuer, subject, delegate_address, &scopes, issued_at, expires_at);
    serde_wasm_bindgen::to_value(&claim)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn create_rotation_claim_wasm(
    issuer: &str,
    subject: &str,
    new_address: &str,
    issued_at: u64,
) -> Result<JsValue, JsValue> {
    let claim = claims::create_rotation_claim(issuer, subject, new_address, issued_at);
    serde_wasm_bindgen::to_value(&claim)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn create_revocation_claim_wasm(
    issuer: &str,
    subject: &str,
    reason: Option<String>,
    issued_at: u64,
) -> Result<JsValue, JsValue> {
    let claim = claims::create_revocation_claim(issuer, subject, reason.as_deref(), issued_at);
    serde_wasm_bindgen::to_value(&claim)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn verify_identity_claim_wasm(
    signed_js: JsValue,
    verify_sig_js: JsValue,
) -> Result<JsValue, JsValue> {
    let signed: SignedIdentityClaim = serde_wasm_bindgen::from_value(signed_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;

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

    let result = verify::verify_identity_claim(&signed, &sig_verifier);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}
