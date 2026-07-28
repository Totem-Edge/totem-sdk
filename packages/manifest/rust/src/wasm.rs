use wasm_bindgen::prelude::*;

use crate::canonical;
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
pub fn manifest_digest_wasm(manifest_js: JsValue) -> Result<Vec<u8>, JsValue> {
    let m: serde_json::Value = serde_wasm_bindgen::from_value(manifest_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    Ok(canonical::manifest_digest(&m))
}

#[wasm_bindgen]
pub fn compute_manifest_id_wasm(manifest_js: JsValue) -> Result<String, JsValue> {
    let m: serde_json::Value = serde_wasm_bindgen::from_value(manifest_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    id::compute_manifest_id(&m).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn verify_manifest_wasm(
    signed_js: JsValue,
    verify_sig_js: JsValue,
) -> Result<JsValue, JsValue> {
    let signed: SignedManifest = serde_wasm_bindgen::from_value(signed_js)
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

    let result = verify::verify_manifest(&signed, &sig_verifier);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}
