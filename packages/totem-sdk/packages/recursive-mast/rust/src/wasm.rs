use wasm_bindgen::prelude::*;
use std::collections::HashMap;

use crate::canonical;
use crate::content_keys;
use crate::delegation;
use crate::policy_tree;
use crate::proof_chain;
use crate::types::*;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

// ─── canonical ───────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn canonical_serialize_wasm(
    domain: &str,
    payload_js: JsValue,
    version: u16,
) -> Result<Vec<u8>, JsValue> {
    let payload: HashMap<String, serde_json::Value> = serde_wasm_bindgen::from_value(payload_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse payload: {}", e)))?;
    Ok(canonical::canonical_serialize(domain, &payload, version))
}

#[wasm_bindgen]
pub fn canonical_hash_wasm(
    domain: &str,
    payload_js: JsValue,
    version: u16,
) -> Result<String, JsValue> {
    let payload: HashMap<String, serde_json::Value> = serde_wasm_bindgen::from_value(payload_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse payload: {}", e)))?;
    Ok(canonical::canonical_hash(domain, &payload, version))
}

// ─── content keys ────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn policy_manifest_key_wasm(policy_id: &str, version: u32) -> Result<JsValue, JsValue> {
    let key = content_keys::policy_manifest_key(policy_id, version);
    serde_wasm_bindgen::to_value(&key)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn manifest_digest_key_wasm(digest: &str) -> Result<JsValue, JsValue> {
    let key = content_keys::manifest_digest_key(digest);
    serde_wasm_bindgen::to_value(&key)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn script_key_wasm(script_hash: &str) -> Result<JsValue, JsValue> {
    let key = content_keys::script_key(script_hash);
    serde_wasm_bindgen::to_value(&key)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn proof_key_wasm(policy_root: &str, script_hash: &str) -> Result<JsValue, JsValue> {
    let key = content_keys::proof_key(policy_root, script_hash);
    serde_wasm_bindgen::to_value(&key)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn bundle_key_wasm(bundle_hash: &str) -> Result<JsValue, JsValue> {
    let key = content_keys::bundle_key(bundle_hash);
    serde_wasm_bindgen::to_value(&key)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn parse_content_key_wasm(key: &str) -> Result<JsValue, JsValue> {
    match content_keys::parse_content_key(key) {
        Some(ck) => serde_wasm_bindgen::to_value(&ck)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e))),
        None => Ok(JsValue::NULL),
    }
}

#[wasm_bindgen]
pub fn compute_manifest_digest_wasm(manifest_bytes: &[u8]) -> String {
    content_keys::compute_manifest_digest(manifest_bytes)
}

#[wasm_bindgen]
pub fn compute_bundle_hash_wasm(manifest: &[u8], branches_js: JsValue) -> Result<String, JsValue> {
    let branches: Vec<Vec<u8>> = serde_wasm_bindgen::from_value(branches_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse branches: {}", e)))?;
    Ok(content_keys::compute_bundle_hash(manifest, &branches))
}

#[wasm_bindgen]
pub fn compute_script_hash_wasm(script: &str) -> String {
    content_keys::compute_script_hash(script)
}

// ─── policy tree ─────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn build_policy_tree_wasm(nodes_js: JsValue) -> Result<JsValue, JsValue> {
    let nodes: Vec<PolicyNodeInput> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse nodes: {}", e)))?;
    match policy_tree::build_policy_tree(&nodes) {
        Ok(tree) => serde_wasm_bindgen::to_value(&tree)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn find_policy_node_wasm(tree_js: JsValue, id: &str) -> Result<JsValue, JsValue> {
    let tree: PolicyTree = serde_wasm_bindgen::from_value(tree_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse tree: {}", e)))?;
    match policy_tree::find_policy_node(&tree, id) {
        Some(node) => serde_wasm_bindgen::to_value(node)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e))),
        None => Ok(JsValue::NULL),
    }
}

#[wasm_bindgen]
pub fn get_policy_path_wasm(tree_js: JsValue, target_id: &str) -> Result<JsValue, JsValue> {
    let tree: PolicyTree = serde_wasm_bindgen::from_value(tree_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse tree: {}", e)))?;
    let path = policy_tree::get_policy_path(&tree, target_id);
    serde_wasm_bindgen::to_value(&path)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn get_policy_leaves_wasm(tree_js: JsValue) -> Result<JsValue, JsValue> {
    let tree: PolicyTree = serde_wasm_bindgen::from_value(tree_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse tree: {}", e)))?;
    let leaves = policy_tree::get_policy_leaves(&tree);
    serde_wasm_bindgen::to_value(&leaves)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

// ─── delegation ──────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn build_delegation_script_wasm(
    delegator: &str,
    delegate: &str,
    constraints_js: JsValue,
) -> Result<String, JsValue> {
    let constraints: DelegationConstraints = serde_wasm_bindgen::from_value(constraints_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse constraints: {}", e)))?;
    Ok(delegation::build_delegation_script(delegator, delegate, &constraints))
}

#[wasm_bindgen]
pub fn build_delegation_link_wasm(
    delegator: &str,
    delegate: &str,
    policy_root: &str,
    proof: &str,
    constraints_js: JsValue,
    sequence: u32,
) -> Result<JsValue, JsValue> {
    let constraints: DelegationConstraints = serde_wasm_bindgen::from_value(constraints_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse constraints: {}", e)))?;
    let link = delegation::build_delegation_link(delegator, delegate, policy_root, proof, constraints, sequence);
    serde_wasm_bindgen::to_value(&link)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn build_delegation_chain_wasm(links_js: JsValue) -> Result<JsValue, JsValue> {
    let links: Vec<DelegationLink> = serde_wasm_bindgen::from_value(links_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse links: {}", e)))?;
    match delegation::build_delegation_chain(&links) {
        Ok(chain) => serde_wasm_bindgen::to_value(&chain)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn verify_delegation_chain_wasm(chain_js: JsValue) -> Result<JsValue, JsValue> {
    let chain: DelegationChain = serde_wasm_bindgen::from_value(chain_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse chain: {}", e)))?;
    let result = delegation::verify_delegation_chain(&chain);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn to_delegation_chain_script_wasm(chain_js: JsValue) -> Result<String, JsValue> {
    let chain: DelegationChain = serde_wasm_bindgen::from_value(chain_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse chain: {}", e)))?;
    Ok(delegation::to_delegation_chain_script(&chain))
}

// ─── proof chain ─────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn build_proof_chain_wasm(links_js: JsValue) -> Result<JsValue, JsValue> {
    let links: Vec<ProofLink> = serde_wasm_bindgen::from_value(links_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse links: {}", e)))?;
    match proof_chain::build_proof_chain(&links) {
        Ok(chain) => serde_wasm_bindgen::to_value(&chain)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e))),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn verify_proof_chain_wasm(
    chain_js: JsValue,
    expected_leaf_script_hash: Option<String>,
    verify_membership_js: JsValue,
) -> Result<JsValue, JsValue> {
    let chain: ProofChain = serde_wasm_bindgen::from_value(chain_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse chain: {}", e)))?;

    let verify_fn = js_sys::Function::from(verify_membership_js);
    let verifier = move |script: &str, proof: &str, root: &str| -> bool {
        let this = JsValue::NULL;
        let args = js_sys::Array::new();
        args.push(&JsValue::from_str(script));
        args.push(&JsValue::from_str(proof));
        args.push(&JsValue::from_str(root));
        match verify_fn.call1(&this, &args) {
            Ok(result) => result.as_bool().unwrap_or(false),
            Err(_) => false,
        }
    };

    let result = proof_chain::verify_proof_chain(
        &chain,
        expected_leaf_script_hash.as_deref(),
        &verifier,
    );
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
}

#[wasm_bindgen]
pub fn to_minima_proof_expression_wasm(link_js: JsValue) -> Result<String, JsValue> {
    let link: ProofLink = serde_wasm_bindgen::from_value(link_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse link: {}", e)))?;
    Ok(proof_chain::to_minima_proof_expression(&link))
}

#[wasm_bindgen]
pub fn to_nested_mast_script_wasm(chain_js: JsValue) -> Result<String, JsValue> {
    let chain: ProofChain = serde_wasm_bindgen::from_value(chain_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse chain: {}", e)))?;
    Ok(proof_chain::to_nested_mast_script(&chain))
}
