use wasm_bindgen::prelude::*;

use crate::commitment;
use crate::types::*;
use crate::verify;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn sha3_hex_wasm(data: &[u8]) -> String {
    commitment::sha3_hex(data)
}

#[wasm_bindgen]
pub fn compute_vtxo_id_wasm(pool_id: &str, owner: &str, amount: &str, token_id: &str, nonce: &str) -> String {
    commitment::compute_vtxo_id(pool_id, owner, amount, token_id, nonce)
}

#[wasm_bindgen]
pub fn compute_pool_id_wasm(operator: &str, token_id: &str, nonce: &str) -> String {
    commitment::compute_pool_id(operator, token_id, nonce)
}

#[wasm_bindgen]
pub fn compute_commitment_root_wasm(leaves_js: JsValue) -> Result<String, JsValue> {
    let leaves: Vec<Vec<u8>> = serde_wasm_bindgen::from_value(leaves_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse leaves: {}", e)))?;
    Ok(commitment::compute_commitment_root(&leaves))
}

#[wasm_bindgen]
pub fn verify_merkle_proof_wasm(
    leaf: &[u8], proof_js: JsValue, root: &str, leaf_index: usize,
) -> Result<bool, JsValue> {
    let proof: Vec<Vec<u8>> = serde_wasm_bindgen::from_value(proof_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse proof: {}", e)))?;
    Ok(commitment::verify_merkle_proof(leaf, &proof, root, leaf_index))
}

#[wasm_bindgen]
pub fn verify_vtxo_wasm(vtxo_js: JsValue) -> Result<JsValue, JsValue> {
    let vtxo: OmniaVtxo = serde_wasm_bindgen::from_value(vtxo_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    let result = verify::verify_vtxo(&vtxo);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn verify_vtxo_proof_wasm(vtxo_js: JsValue, commitment_root: &str) -> Result<JsValue, JsValue> {
    let vtxo: OmniaVtxo = serde_wasm_bindgen::from_value(vtxo_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse: {}", e)))?;
    let result = verify::verify_vtxo_proof(&vtxo, commitment_root);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn verify_conservation_wasm(inputs_js: JsValue, outputs_js: JsValue, mode: &str) -> Result<JsValue, JsValue> {
    let inputs: Vec<OmniaVtxo> = serde_wasm_bindgen::from_value(inputs_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse inputs: {}", e)))?;
    let outputs: Vec<OmniaVtxo> = serde_wasm_bindgen::from_value(outputs_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse outputs: {}", e)))?;
    let input_refs: Vec<&OmniaVtxo> = inputs.iter().collect();
    let output_refs: Vec<&OmniaVtxo> = outputs.iter().collect();
    let result = verify::verify_conservation(&input_refs, &output_refs, mode);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}
