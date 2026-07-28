/// Totem SDK Core — Quantum-resistant WOTS+ cryptographic engine
///
/// Compiled to WASM for use in browsers, Node.js, Pear/Bare, and edge devices.
/// All functions are byte-exact compatible with the Minima Java node.

pub mod params;
pub mod utils;
pub mod streamable;
pub mod java_streamables;
pub mod wots;
pub mod bip39;
pub mod minima32;
pub mod derive;
pub mod script;
pub mod transaction;
pub mod verify;
pub mod mmr;
pub mod treekey;
pub mod txpow_mine;
pub mod wasm_tree;

use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------------------
// WASM bindings — expose core functions to JavaScript
// ---------------------------------------------------------------------------

/// WOTS parameters as a JS object.
#[wasm_bindgen]
pub fn get_params() -> JsValue {
    let obj = js_sys::Object::new();
    js_sys::Reflect::set(&obj, &"w".into(), &(params::WOTS_W as u32).into()).unwrap();
    js_sys::Reflect::set(&obj, &"n".into(), &(params::WOTS_N as u32).into()).unwrap();
    js_sys::Reflect::set(&obj, &"L".into(), &(params::WOTS_L as u32).into()).unwrap();
    js_sys::Reflect::set(&obj, &"maxDigit".into(), &(params::MAX_DIGIT as u32).into()).unwrap();
    js_sys::Reflect::set(&obj, &"maxSignatures".into(), &(params::MAX_SIGNATURES as u32).into()).unwrap();
    js_sys::Reflect::set(&obj, &"signatureLevels".into(), &(params::SIGNATURE_LEVELS as u32).into()).unwrap();
    js_sys::Reflect::set(&obj, &"addressPrefix".into(), &params::ADDRESS_PREFIX.into()).unwrap();
    obj.into()
}

/// Convert bytes to uppercase hex string.
#[wasm_bindgen]
pub fn bytes_to_hex_wasm(bytes: &[u8]) -> String {
    utils::bytes_to_hex(bytes)
}

/// Convert hex string to bytes.
#[wasm_bindgen]
pub fn hex_to_bytes_wasm(hex_str: &str) -> Result<Vec<u8>, JsValue> {
    utils::hex_to_bytes(hex_str).map_err(|e| JsValue::from_str(&e))
}

/// Concatenate multiple byte arrays.
#[wasm_bindgen]
pub fn concat_bytes_wasm(a: &[u8], b: &[u8]) -> Vec<u8> {
    utils::concat_bytes(&[a, b])
}

/// SHA3-256 hash of data.
#[wasm_bindgen]
pub fn sha3_256_wasm(data: &[u8]) -> Vec<u8> {
    use sha3::{Digest, Sha3_256};
    let mut hasher = Sha3_256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

/// Expand master seed into L private key chains.
/// Returns a flat array of L×32 bytes (1088 bytes total).
#[wasm_bindgen]
pub fn expand_private_key_wasm(seed: &[u8]) -> Vec<u8> {
    let keys = wots::expand_private_key(seed);
    let mut flat = Vec::with_capacity(keys.len() * 32);
    for key in keys {
        flat.extend_from_slice(&key);
    }
    flat
}

/// Hash a value k times (hash chain).
#[wasm_bindgen]
pub fn hash_chain_wasm(x: &[u8], rounds: u16) -> Vec<u8> {
    wots::hash_chain(x, rounds)
}

/// Derive WOTS public key digest (32 bytes).
#[wasm_bindgen]
pub fn derive_pk_digest_wasm(seed: &[u8], key_index: u32) -> Vec<u8> {
    wots::derive_pk_digest(seed, key_index)
}

/// Derive full WOTS public key (1088 bytes).
#[wasm_bindgen]
pub fn derive_full_public_key_wasm(seed: &[u8], key_index: u32) -> Vec<u8> {
    wots::derive_full_public_key(seed, key_index)
}

/// Sign a message using WOTS. Returns 1088-byte signature.
#[wasm_bindgen]
pub fn wots_sign_wasm(seed: &[u8], key_index: u32, message: &[u8]) -> Vec<u8> {
    wots::wots_sign(seed, key_index, message)
}

/// Verify WOTS signature against full 1088-byte public key.
#[wasm_bindgen]
pub fn wots_verify_wasm(sig: &[u8], message: &[u8], pk_full: &[u8]) -> bool {
    wots::wots_verify(sig, message, pk_full)
}

/// Verify WOTS signature against 32-byte public key digest.
#[wasm_bindgen]
pub fn wots_verify_digest_wasm(sig: &[u8], message: &[u8], pk_digest: &[u8]) -> bool {
    wots::wots_verify_digest(sig, message, pk_digest)
}

/// Recover public key digest from signature.
#[wasm_bindgen]
pub fn wots_pk_from_sig_wasm(message: &[u8], signature: &[u8]) -> Vec<u8> {
    wots::wots_pk_from_sig(message, signature)
}

/// Derive chain seed for a specific key index (Java-compatible).
#[wasm_bindgen]
pub fn derive_chain_seed_wasm(seed: &[u8], key_index: u32) -> Vec<u8> {
    java_streamables::derive_chain_seed_java(seed, key_index)
}

/// Derive per-address seed from root seed.
#[wasm_bindgen]
pub fn derive_per_address_seed_wasm(root_seed: &[u8], address_index: u32) -> Vec<u8> {
    java_streamables::derive_per_address_seed(root_seed, address_index)
}

/// Derive root private seed from BIP39 seed.
#[wasm_bindgen]
pub fn derive_root_priv_seed_wasm(bip39_seed: &[u8]) -> Vec<u8> {
    java_streamables::derive_root_priv_seed(bip39_seed)
}

/// Convert BIP39 seed phrase to 32-byte seed (SHA3-256, no PBKDF2).
#[wasm_bindgen]
pub fn phrase_to_seed_wasm(phrase: &str) -> Vec<u8> {
    bip39::phrase_to_seed(phrase)
}

/// Generate a 24-word BIP39 mnemonic from random entropy.
#[wasm_bindgen]
pub fn generate_mnemonic_wasm() -> String {
    bip39::generate_word_list()
}

/// Validate a BIP39 mnemonic phrase.
#[wasm_bindgen]
pub fn validate_phrase_wasm(phrase: &str) -> bool {
    bip39::validate_phrase(phrase)
}

/// Clean and normalize a seed phrase (prefix matching).
#[wasm_bindgen]
pub fn clean_seed_phrase_wasm(phrase: &str) -> String {
    bip39::clean_seed_phrase(phrase)
}

/// Encode bytes to Minima Mx address format.
#[wasm_bindgen]
pub fn make_mx_address_wasm(root32: &[u8]) -> Result<String, JsValue> {
    minima32::make_mx_address(root32).map_err(|e| JsValue::from_str(&e))
}

/// Decode a Minima Mx address to bytes.
#[wasm_bindgen]
pub fn parse_mx_address_wasm(address: &str) -> Result<Vec<u8>, JsValue> {
    minima32::parse_mx_address(address).map_err(|e| JsValue::from_str(&e))
}

/// Derive Mx address from WOTS public key.
#[wasm_bindgen]
pub fn wots_address_from_keypair_wasm(seed: &[u8], key_index: u32) -> Result<String, JsValue> {
    let pk_digest = wots::derive_pk_digest(seed, key_index);
    let script = script::script_from_wots_pk(&pk_digest);
    let address = derive::script_to_address(&script);
    minima32::make_mx_address(&address).map_err(|e| JsValue::from_str(&e))
}

/// Serialize a transaction for digest computation.
#[wasm_bindgen]
pub fn serialize_transaction_wasm(tx_json: &str) -> Result<Vec<u8>, JsValue> {
    transaction::serialize_transaction_from_json(tx_json).map_err(|e| JsValue::from_str(&e))
}

/// Compute transaction digest (SHA3-256 of serialized tx).
#[wasm_bindgen]
pub fn compute_transaction_digest_wasm(serialized_tx: &[u8]) -> Vec<u8> {
    transaction::compute_transaction_digest(serialized_tx)
}

/// Precompute output coin IDs before transaction digest.
#[wasm_bindgen]
pub fn precompute_transaction_coin_id_wasm(txid: &[u8], output_index: u32) -> Vec<u8> {
    java_streamables::precompute_transaction_coin_id(txid, output_index)
}

/// Verify a tree signature (3-proof chain).
#[wasm_bindgen]
pub fn verify_tree_signature_wasm(
    root_public_key: &[u8],
    message: &[u8],
    signature_json: &str,
) -> Result<bool, JsValue> {
    verify::verify_tree_signature(root_public_key, message, signature_json)
        .map_err(|e| JsValue::from_str(&e))
}

/// Constant-time comparison of two byte arrays.
#[wasm_bindgen]
pub fn timing_safe_equal_wasm(a: &[u8], b: &[u8]) -> bool {
    verify::timing_safe_equal(a, b)
}

/// Create a Sign-In With Wallet challenge.
#[wasm_bindgen]
pub fn create_challenge_wasm(domain: &str, statement: &str) -> Result<String, JsValue> {
    verify::create_challenge(domain, statement).map_err(|e| JsValue::from_str(&e))
}

/// Validate a Sign-In With Wallet challenge.
#[wasm_bindgen]
pub fn validate_challenge_wasm(challenge_json: &str, domain: &str) -> Result<bool, JsValue> {
    verify::validate_challenge(challenge_json, domain).map_err(|e| JsValue::from_str(&e))
}

/// Write MiniNumber (Java-compatible serialization).
#[wasm_bindgen]
pub fn write_mini_number_wasm(value: i64, scale: u8) -> Vec<u8> {
    streamable::write_mini_number(value, scale)
}

/// Write MiniData (Java-compatible serialization).
#[wasm_bindgen]
pub fn write_mini_data_wasm(data: &[u8]) -> Vec<u8> {
    streamable::write_mini_data(data)
}

/// Write MiniString (Java-compatible serialization).
#[wasm_bindgen]
pub fn write_mini_string_wasm(s: &str) -> Vec<u8> {
    streamable::write_mini_string(s)
}

// ---------------------------------------------------------------------------
// MMR & TreeKey bindings
// ---------------------------------------------------------------------------

/// Create a unified child TreeKey for a spend address.
/// Returns the root public key (32 bytes).
#[wasm_bindgen]
pub fn create_unified_child_tree_key_wasm(base_seed: &[u8], index: u32) -> Result<Vec<u8>, JsValue> {
    let tree = treekey::create_unified_child_tree_key(base_seed, index)
        .map_err(|e| JsValue::from_str(&e))?;
    Ok(tree.get_public_key().to_vec())
}

/// Create a unified root identity TreeKey.
/// Returns the root public key (32 bytes).
#[wasm_bindgen]
pub fn create_unified_root_tree_key_wasm(base_seed: &[u8]) -> Result<Vec<u8>, JsValue> {
    let tree = treekey::create_unified_root_tree_key(base_seed)
        .map_err(|e| JsValue::from_str(&e))?;
    Ok(tree.get_public_key().to_vec())
}

/// Derive a unified address public key without constructing the full TreeKey.
#[wasm_bindgen]
pub fn derive_unified_address_public_key_wasm(base_seed: &[u8], index: u32) -> Result<Vec<u8>, JsValue> {
    treekey::derive_unified_address_public_key(base_seed, index)
        .map_err(|e| JsValue::from_str(&e))
}

/// Verify an MMR proof for a leaf public key.
#[wasm_bindgen]
pub fn verify_mmr_proof_wasm(leaf_pubkey: &[u8], proof_json: &str, expected_root: &[u8]) -> Result<bool, JsValue> {
    verify::verify_mmr_proof_from_json(leaf_pubkey, proof_json, expected_root)
        .map_err(|e| JsValue::from_str(&e))
}

/// Build MMR tree from public key digests and return the root.
#[wasm_bindgen]
pub fn mmr_root_from_public_keys_wasm(pubkeys_flat: &[u8], count: u32) -> Result<Vec<u8>, JsValue> {
    let pk_size = 32usize;
    let mut pubkeys = Vec::new();
    for i in 0..count as usize {
        let start = i * pk_size;
        let end = start + pk_size;
        if end > pubkeys_flat.len() {
            return Err(JsValue::from_str("pubkeys_flat too short"));
        }
        pubkeys.push(pubkeys_flat[start..end].to_vec());
    }
    let tree = mmr::MMRTree::from_public_keys(&pubkeys);
    match tree.get_root() {
        Some(root) => Ok(root.data),
        None => Err(JsValue::from_str("Failed to compute MMR root")),
    }
}

// ---------------------------------------------------------------------------
// Batch WOTS APIs
// ---------------------------------------------------------------------------

/// Sign multiple messages with the same key index.
/// Returns flat concatenated signatures: [sig0(1088B), sig1(1088B), ...]
#[wasm_bindgen]
pub fn wots_sign_batch_wasm(seed: &[u8], key_index: u32, messages_flat: &[u8], count: u32) -> Vec<u8> {
    let msg_size = 32usize;
    let mut messages = Vec::with_capacity(count as usize);
    for i in 0..count as usize {
        let start = i * msg_size;
        let end = start + msg_size;
        messages.push(messages_flat[start..end].to_vec());
    }
    wots::wots_sign_batch(seed, key_index, &messages)
}

/// Derive public key digests for a range of key indices.
/// Returns flat concatenated digests: [pk0(32B), pk1(32B), ...]
#[wasm_bindgen]
pub fn derive_pk_digest_batch_wasm(seed: &[u8], start_index: u32, count: u32) -> Vec<u8> {
    wots::derive_pk_digest_batch(seed, start_index, count)
}

/// Derive full public keys for a range of key indices.
/// Returns flat concatenated keys: [pk0(1088B), pk1(1088B), ...]
#[wasm_bindgen]
pub fn derive_full_public_key_batch_wasm(seed: &[u8], start_index: u32, count: u32) -> Vec<u8> {
    wots::derive_full_public_key_batch(seed, start_index, count)
}

// ---------------------------------------------------------------------------
// TxPoW Mining
// ---------------------------------------------------------------------------

/// Mine a TxPoW by iterating the header nonce.
/// Returns JSON: { minedHeaderBytes: hex, txpowId: hex, nonce: string, iterations: string }
#[wasm_bindgen]
pub fn mine_txpow_wasm(tx_body_bytes: &[u8], txn_difficulty: &[u8], time_milli: u32, max_iterations: u32) -> Result<String, JsValue> {
    let result = txpow_mine::mine_txpow(tx_body_bytes, txn_difficulty, time_milli as u64, max_iterations as u64)
        .map_err(|e| JsValue::from_str(&e))?;

    let json = serde_json::json!({
        "minedHeaderBytes": hex::encode(&result.mined_header_bytes),
        "txpowId": hex::encode(&result.txpow_id),
        "nonce": result.nonce.to_string(),
        "iterations": result.iterations.to_string(),
    });

    serde_json::to_string(&json).map_err(|e| JsValue::from_str(&format!("JSON error: {}", e)))
}

/// Mine a single chunk of nonces. Returns the found nonce as a string, or null.
#[wasm_bindgen]
pub fn mine_txpow_chunk_wasm(
    tx_body_bytes: &[u8],
    txn_difficulty: &[u8],
    time_milli: u32,
    start_nonce: u32,
    chunk_size: u32,
) -> Option<String> {
    txpow_mine::mine_txpow_chunk(
        tx_body_bytes,
        txn_difficulty,
        time_milli as u64,
        start_nonce as u64,
        chunk_size as u64,
    ).map(|n| n.to_string())
}

// ---------------------------------------------------------------------------
// Stateful WasmTreeKey
// ---------------------------------------------------------------------------

/// Create a new WasmTreeKey from a 32-byte seed.
/// Returns an opaque handle (index) for use with other wasm_tree_key_* functions.
/// The tree is stored in a global registry.
#[wasm_bindgen]
pub fn wasm_tree_key_new(seed: &[u8], keys_per_level: u32, levels: u32) -> Result<u32, JsValue> {
    let tree = wasm_tree::WasmTreeKey::new(seed, keys_per_level as usize, levels as usize)
        .map_err(|e| JsValue::from_str(&e))?;
    Ok(WASM_TREE_REGISTRY.lock().unwrap().insert(tree))
}

/// Sign data with the current key and increment usage.
/// Returns JSON-serialized TreeSignature.
#[wasm_bindgen]
pub fn wasm_tree_key_sign(handle: u32, data: &[u8]) -> Result<String, JsValue> {
    let mut registry = WASM_TREE_REGISTRY.lock().unwrap();
    let tree = registry.get_mut(handle)
        .ok_or_else(|| JsValue::from_str("Invalid tree handle"))?;
    tree.sign(data).map_err(|e| JsValue::from_str(&e))
}

/// Get the root public key (32 bytes).
#[wasm_bindgen]
pub fn wasm_tree_key_get_public_key(handle: u32) -> Result<Vec<u8>, JsValue> {
    let registry = WASM_TREE_REGISTRY.lock().unwrap();
    let tree = registry.get(handle)
        .ok_or_else(|| JsValue::from_str("Invalid tree handle"))?;
    Ok(tree.get_public_key().to_vec())
}

/// Get current usage count.
#[wasm_bindgen]
pub fn wasm_tree_key_get_uses(handle: u32) -> Result<u32, JsValue> {
    let registry = WASM_TREE_REGISTRY.lock().unwrap();
    let tree = registry.get(handle)
        .ok_or_else(|| JsValue::from_str("Invalid tree handle"))?;
    Ok(tree.get_uses() as u32)
}

/// Set the usage counter.
#[wasm_bindgen]
pub fn wasm_tree_key_set_uses(handle: u32, uses: u32) -> Result<(), JsValue> {
    let mut registry = WASM_TREE_REGISTRY.lock().unwrap();
    let tree = registry.get_mut(handle)
        .ok_or_else(|| JsValue::from_str("Invalid tree handle"))?;
    tree.set_uses(uses as u64);
    Ok(())
}

/// Get the maximum number of signatures.
#[wasm_bindgen]
pub fn wasm_tree_key_get_max_uses(handle: u32) -> Result<u32, JsValue> {
    let registry = WASM_TREE_REGISTRY.lock().unwrap();
    let tree = registry.get(handle)
        .ok_or_else(|| JsValue::from_str("Invalid tree handle"))?;
    Ok(tree.get_max_uses() as u32)
}

/// Free a WasmTreeKey.
#[wasm_bindgen]
pub fn wasm_tree_key_free(handle: u32) {
    WASM_TREE_REGISTRY.lock().unwrap().remove(handle);
}

// ---------------------------------------------------------------------------
// Global TreeKey registry (handles → WasmTreeKey)
// ---------------------------------------------------------------------------

use std::sync::Mutex;
use std::collections::HashMap;

static WASM_TREE_REGISTRY: once_cell::sync::Lazy<Mutex<TreeRegistry>> =
    once_cell::sync::Lazy::new(|| Mutex::new(TreeRegistry::new()));

struct TreeRegistry {
    trees: HashMap<u32, wasm_tree::WasmTreeKey>,
    next_handle: u32,
}

impl TreeRegistry {
    fn new() -> Self {
        TreeRegistry { trees: HashMap::new(), next_handle: 1 }
    }

    fn insert(&mut self, tree: wasm_tree::WasmTreeKey) -> u32 {
        let handle = self.next_handle;
        self.next_handle += 1;
        self.trees.insert(handle, tree);
        handle
    }

    fn get(&self, handle: u32) -> Option<&wasm_tree::WasmTreeKey> {
        self.trees.get(&handle)
    }

    fn get_mut(&mut self, handle: u32) -> Option<&mut wasm_tree::WasmTreeKey> {
        self.trees.get_mut(&handle)
    }

    fn remove(&mut self, handle: u32) {
        self.trees.remove(&handle);
    }
}

// ---------------------------------------------------------------------------
// Module initialization
// ---------------------------------------------------------------------------

/// Initialize the WASM module (called automatically on import).
#[wasm_bindgen(start)]
pub fn init() {
    // Set up panic hook for better error messages
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
}
