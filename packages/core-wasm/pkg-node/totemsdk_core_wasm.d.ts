/* tslint:disable */
/* eslint-disable */

/**
 * Convert bytes to uppercase hex string.
 */
export function bytes_to_hex_wasm(bytes: Uint8Array): string;

/**
 * Clean and normalize a seed phrase (prefix matching).
 */
export function clean_seed_phrase_wasm(phrase: string): string;

/**
 * Compute transaction digest (SHA3-256 of serialized tx).
 */
export function compute_transaction_digest_wasm(serialized_tx: Uint8Array): Uint8Array;

/**
 * Concatenate multiple byte arrays.
 */
export function concat_bytes_wasm(a: Uint8Array, b: Uint8Array): Uint8Array;

/**
 * Create a Sign-In With Wallet challenge.
 */
export function create_challenge_wasm(domain: string, statement: string): string;

/**
 * Create a unified child TreeKey for a spend address.
 * Returns the root public key (32 bytes).
 */
export function create_unified_child_tree_key_wasm(base_seed: Uint8Array, index: number): Uint8Array;

/**
 * Create a unified root identity TreeKey.
 * Returns the root public key (32 bytes).
 */
export function create_unified_root_tree_key_wasm(base_seed: Uint8Array): Uint8Array;

/**
 * Derive chain seed for a specific key index (Java-compatible).
 */
export function derive_chain_seed_wasm(seed: Uint8Array, key_index: number): Uint8Array;

/**
 * Derive full public keys for a range of key indices.
 * Returns flat concatenated keys: [pk0(1088B), pk1(1088B), ...]
 */
export function derive_full_public_key_batch_wasm(seed: Uint8Array, start_index: number, count: number): Uint8Array;

/**
 * Derive full WOTS public key (1088 bytes).
 */
export function derive_full_public_key_wasm(seed: Uint8Array, key_index: number): Uint8Array;

/**
 * Derive per-address seed from root seed.
 */
export function derive_per_address_seed_wasm(root_seed: Uint8Array, address_index: number): Uint8Array;

/**
 * Derive public key digests for a range of key indices.
 * Returns flat concatenated digests: [pk0(32B), pk1(32B), ...]
 */
export function derive_pk_digest_batch_wasm(seed: Uint8Array, start_index: number, count: number): Uint8Array;

/**
 * Derive WOTS public key digest (32 bytes).
 */
export function derive_pk_digest_wasm(seed: Uint8Array, key_index: number): Uint8Array;

/**
 * Derive root private seed from BIP39 seed.
 */
export function derive_root_priv_seed_wasm(bip39_seed: Uint8Array): Uint8Array;

/**
 * Derive a unified address public key without constructing the full TreeKey.
 */
export function derive_unified_address_public_key_wasm(base_seed: Uint8Array, index: number): Uint8Array;

/**
 * Expand master seed into L private key chains.
 * Returns a flat array of L×32 bytes (1088 bytes total).
 */
export function expand_private_key_wasm(seed: Uint8Array): Uint8Array;

/**
 * Generate a 24-word BIP39 mnemonic from random entropy.
 */
export function generate_mnemonic_wasm(): string;

/**
 * WOTS parameters as a JS object.
 */
export function get_params(): any;

/**
 * Hash a value k times (hash chain).
 */
export function hash_chain_wasm(x: Uint8Array, rounds: number): Uint8Array;

/**
 * Convert hex string to bytes.
 */
export function hex_to_bytes_wasm(hex_str: string): Uint8Array;

/**
 * Initialize the WASM module (called automatically on import).
 */
export function init(): void;

/**
 * Encode bytes to Minima Mx address format.
 */
export function make_mx_address_wasm(root32: Uint8Array): string;

/**
 * Mine a single chunk of nonces. Returns the found nonce as a string, or null.
 */
export function mine_txpow_chunk_wasm(tx_body_bytes: Uint8Array, txn_difficulty: Uint8Array, time_milli: number, start_nonce: number, chunk_size: number): string | undefined;

/**
 * Mine a TxPoW by iterating the header nonce.
 * Returns JSON: { minedHeaderBytes: hex, txpowId: hex, nonce: string, iterations: string }
 */
export function mine_txpow_wasm(tx_body_bytes: Uint8Array, txn_difficulty: Uint8Array, time_milli: number, max_iterations: number): string;

/**
 * Build MMR tree from public key digests and return the root.
 */
export function mmr_root_from_public_keys_wasm(pubkeys_flat: Uint8Array, count: number): Uint8Array;

/**
 * Decode a Minima Mx address to bytes.
 */
export function parse_mx_address_wasm(address: string): Uint8Array;

/**
 * Convert BIP39 seed phrase to 32-byte seed (SHA3-256, no PBKDF2).
 */
export function phrase_to_seed_wasm(phrase: string): Uint8Array;

/**
 * Precompute output coin IDs before transaction digest.
 */
export function precompute_transaction_coin_id_wasm(txid: Uint8Array, output_index: number): Uint8Array;

/**
 * Serialize a transaction for digest computation.
 */
export function serialize_transaction_wasm(tx_json: string): Uint8Array;

/**
 * SHA3-256 hash of data.
 */
export function sha3_256_wasm(data: Uint8Array): Uint8Array;

/**
 * Constant-time comparison of two byte arrays.
 */
export function timing_safe_equal_wasm(a: Uint8Array, b: Uint8Array): boolean;

/**
 * Validate a Sign-In With Wallet challenge.
 */
export function validate_challenge_wasm(challenge_json: string, domain: string): boolean;

/**
 * Validate a BIP39 mnemonic phrase.
 */
export function validate_phrase_wasm(phrase: string): boolean;

/**
 * Verify an MMR proof for a leaf public key.
 */
export function verify_mmr_proof_wasm(leaf_pubkey: Uint8Array, proof_json: string, expected_root: Uint8Array): boolean;

/**
 * Verify a tree signature (3-proof chain).
 */
export function verify_tree_signature_wasm(root_public_key: Uint8Array, message: Uint8Array, signature_json: string): boolean;

/**
 * Free a WasmTreeKey.
 */
export function wasm_tree_key_free(handle: number): void;

/**
 * Get the maximum number of signatures.
 */
export function wasm_tree_key_get_max_uses(handle: number): number;

/**
 * Get the root public key (32 bytes).
 */
export function wasm_tree_key_get_public_key(handle: number): Uint8Array;

/**
 * Get current usage count.
 */
export function wasm_tree_key_get_uses(handle: number): number;

/**
 * Create a new WasmTreeKey from a 32-byte seed.
 * Returns an opaque handle (index) for use with other wasm_tree_key_* functions.
 * The tree is stored in a global registry.
 */
export function wasm_tree_key_new(seed: Uint8Array, keys_per_level: number, levels: number): number;

/**
 * Set the usage counter.
 */
export function wasm_tree_key_set_uses(handle: number, uses: number): void;

/**
 * Sign data with the current key and increment usage.
 * Returns JSON-serialized TreeSignature.
 */
export function wasm_tree_key_sign(handle: number, data: Uint8Array): string;

/**
 * Derive Mx address from WOTS public key.
 */
export function wots_address_from_keypair_wasm(seed: Uint8Array, key_index: number): string;

/**
 * Recover public key digest from signature.
 */
export function wots_pk_from_sig_wasm(message: Uint8Array, signature: Uint8Array): Uint8Array;

/**
 * Sign multiple messages with the same key index.
 * Returns flat concatenated signatures: [sig0(1088B), sig1(1088B), ...]
 */
export function wots_sign_batch_wasm(seed: Uint8Array, key_index: number, messages_flat: Uint8Array, count: number): Uint8Array;

/**
 * Sign a message using WOTS. Returns 1088-byte signature.
 */
export function wots_sign_wasm(seed: Uint8Array, key_index: number, message: Uint8Array): Uint8Array;

/**
 * Verify WOTS signature against 32-byte public key digest.
 */
export function wots_verify_digest_wasm(sig: Uint8Array, message: Uint8Array, pk_digest: Uint8Array): boolean;

/**
 * Verify WOTS signature against full 1088-byte public key.
 */
export function wots_verify_wasm(sig: Uint8Array, message: Uint8Array, pk_full: Uint8Array): boolean;

/**
 * Write MiniData (Java-compatible serialization).
 */
export function write_mini_data_wasm(data: Uint8Array): Uint8Array;

/**
 * Write MiniNumber (Java-compatible serialization).
 */
export function write_mini_number_wasm(value: bigint, scale: number): Uint8Array;

/**
 * Write MiniString (Java-compatible serialization).
 */
export function write_mini_string_wasm(s: string): Uint8Array;
