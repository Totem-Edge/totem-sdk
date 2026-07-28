use wasm_bindgen::prelude::*;

use crate::types::*;
use crate::verify;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn verify_ownership_proof_wasm(
    proof_js: JsValue,
    verify_sig_js: JsValue,
) -> Result<JsValue, JsValue> {
    let proof: OwnershipProof = serde_wasm_bindgen::from_value(proof_js)
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

    let result = verify::verify_ownership_proof(&proof, &sig_verifier);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}
