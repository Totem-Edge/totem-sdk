use wasm_bindgen::prelude::*;
use sha3::{Digest, Sha3_256};
use sha2::Sha256;
use crate::types::*;
use crate::eval;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

fn sha3_256_impl(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha3_256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

fn sha256_impl(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

fn wots_verify_impl(_sig: &[u8], _digest: &[u8], _pk: &[u8]) -> bool {
    false
}

#[wasm_bindgen]
pub fn evaluate_script_wasm(
    script: &str,
    witness_js: JsValue,
    tx_ctx_js: JsValue,
) -> Result<JsValue, JsValue> {
    let witness: ScriptWitness = serde_wasm_bindgen::from_value(witness_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse witness: {}", e)))?;
    let tx_ctx: TxContext = serde_wasm_bindgen::from_value(tx_ctx_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse txCtx: {}", e)))?;

    match eval::evaluate_script(script, witness, tx_ctx, sha3_256_impl, sha256_impl, wots_verify_impl) {
        Ok(result) => {
            serde_wasm_bindgen::to_value(&result)
                .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
        }
        Err(e) => {
            let error_result = EvalResult {
                passed: false,
                trace: vec![],
                error: Some(e),
                instructions_used: 0,
            };
            serde_wasm_bindgen::to_value(&error_result)
                .map_err(|e| JsValue::from_str(&format!("Failed to serialize error: {}", e)))
        }
    }
}

#[wasm_bindgen]
pub fn parse_script_wasm(source: &str) -> Result<JsValue, JsValue> {
    let ast = crate::parser::parse_script(source)
        .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&ast)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize AST: {}", e)))
}
