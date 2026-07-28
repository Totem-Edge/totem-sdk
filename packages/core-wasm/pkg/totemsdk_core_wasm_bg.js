/**
 * Convert bytes to uppercase hex string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytes_to_hex_wasm(bytes) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.bytes_to_hex_wasm(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Clean and normalize a seed phrase (prefix matching).
 * @param {string} phrase
 * @returns {string}
 */
export function clean_seed_phrase_wasm(phrase) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(phrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.clean_seed_phrase_wasm(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Compute transaction digest (SHA3-256 of serialized tx).
 * @param {Uint8Array} serialized_tx
 * @returns {Uint8Array}
 */
export function compute_transaction_digest_wasm(serialized_tx) {
    const ptr0 = passArray8ToWasm0(serialized_tx, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.compute_transaction_digest_wasm(ptr0, len0);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Concatenate multiple byte arrays.
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {Uint8Array}
 */
export function concat_bytes_wasm(a, b) {
    const ptr0 = passArray8ToWasm0(a, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(b, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.concat_bytes_wasm(ptr0, len0, ptr1, len1);
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * Create a Sign-In With Wallet challenge.
 * @param {string} domain
 * @param {string} statement
 * @returns {string}
 */
export function create_challenge_wasm(domain, statement) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passStringToWasm0(domain, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(statement, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.create_challenge_wasm(ptr0, len0, ptr1, len1);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Create a unified child TreeKey for a spend address.
 * Returns the root public key (32 bytes).
 * @param {Uint8Array} base_seed
 * @param {number} index
 * @returns {Uint8Array}
 */
export function create_unified_child_tree_key_wasm(base_seed, index) {
    const ptr0 = passArray8ToWasm0(base_seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.create_unified_child_tree_key_wasm(ptr0, len0, index);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Create a unified root identity TreeKey.
 * Returns the root public key (32 bytes).
 * @param {Uint8Array} base_seed
 * @returns {Uint8Array}
 */
export function create_unified_root_tree_key_wasm(base_seed) {
    const ptr0 = passArray8ToWasm0(base_seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.create_unified_root_tree_key_wasm(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Derive chain seed for a specific key index (Java-compatible).
 * @param {Uint8Array} seed
 * @param {number} key_index
 * @returns {Uint8Array}
 */
export function derive_chain_seed_wasm(seed, key_index) {
    const ptr0 = passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.derive_chain_seed_wasm(ptr0, len0, key_index);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Derive full public keys for a range of key indices.
 * Returns flat concatenated keys: [pk0(1088B), pk1(1088B), ...]
 * @param {Uint8Array} seed
 * @param {number} start_index
 * @param {number} count
 * @returns {Uint8Array}
 */
export function derive_full_public_key_batch_wasm(seed, start_index, count) {
    const ptr0 = passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.derive_full_public_key_batch_wasm(ptr0, len0, start_index, count);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Derive full WOTS public key (1088 bytes).
 * @param {Uint8Array} seed
 * @param {number} key_index
 * @returns {Uint8Array}
 */
export function derive_full_public_key_wasm(seed, key_index) {
    const ptr0 = passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.derive_full_public_key_wasm(ptr0, len0, key_index);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Derive per-address seed from root seed.
 * @param {Uint8Array} root_seed
 * @param {number} address_index
 * @returns {Uint8Array}
 */
export function derive_per_address_seed_wasm(root_seed, address_index) {
    const ptr0 = passArray8ToWasm0(root_seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.derive_per_address_seed_wasm(ptr0, len0, address_index);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Derive public key digests for a range of key indices.
 * Returns flat concatenated digests: [pk0(32B), pk1(32B), ...]
 * @param {Uint8Array} seed
 * @param {number} start_index
 * @param {number} count
 * @returns {Uint8Array}
 */
export function derive_pk_digest_batch_wasm(seed, start_index, count) {
    const ptr0 = passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.derive_pk_digest_batch_wasm(ptr0, len0, start_index, count);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Derive WOTS public key digest (32 bytes).
 * @param {Uint8Array} seed
 * @param {number} key_index
 * @returns {Uint8Array}
 */
export function derive_pk_digest_wasm(seed, key_index) {
    const ptr0 = passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.derive_pk_digest_wasm(ptr0, len0, key_index);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Derive root private seed from BIP39 seed.
 * @param {Uint8Array} bip39_seed
 * @returns {Uint8Array}
 */
export function derive_root_priv_seed_wasm(bip39_seed) {
    const ptr0 = passArray8ToWasm0(bip39_seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.derive_root_priv_seed_wasm(ptr0, len0);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Derive a unified address public key without constructing the full TreeKey.
 * @param {Uint8Array} base_seed
 * @param {number} index
 * @returns {Uint8Array}
 */
export function derive_unified_address_public_key_wasm(base_seed, index) {
    const ptr0 = passArray8ToWasm0(base_seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.derive_unified_address_public_key_wasm(ptr0, len0, index);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Expand master seed into L private key chains.
 * Returns a flat array of L×32 bytes (1088 bytes total).
 * @param {Uint8Array} seed
 * @returns {Uint8Array}
 */
export function expand_private_key_wasm(seed) {
    const ptr0 = passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.expand_private_key_wasm(ptr0, len0);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Generate a 24-word BIP39 mnemonic from random entropy.
 * @returns {string}
 */
export function generate_mnemonic_wasm() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.generate_mnemonic_wasm();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * WOTS parameters as a JS object.
 * @returns {any}
 */
export function get_params() {
    const ret = wasm.get_params();
    return ret;
}

/**
 * Hash a value k times (hash chain).
 * @param {Uint8Array} x
 * @param {number} rounds
 * @returns {Uint8Array}
 */
export function hash_chain_wasm(x, rounds) {
    const ptr0 = passArray8ToWasm0(x, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.hash_chain_wasm(ptr0, len0, rounds);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Convert hex string to bytes.
 * @param {string} hex_str
 * @returns {Uint8Array}
 */
export function hex_to_bytes_wasm(hex_str) {
    const ptr0 = passStringToWasm0(hex_str, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.hex_to_bytes_wasm(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Initialize the WASM module (called automatically on import).
 */
export function init() {
    wasm.init();
}

/**
 * Encode bytes to Minima Mx address format.
 * @param {Uint8Array} root32
 * @returns {string}
 */
export function make_mx_address_wasm(root32) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passArray8ToWasm0(root32, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.make_mx_address_wasm(ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Mine a single chunk of nonces. Returns the found nonce as a string, or null.
 * @param {Uint8Array} tx_body_bytes
 * @param {Uint8Array} txn_difficulty
 * @param {number} time_milli
 * @param {number} start_nonce
 * @param {number} chunk_size
 * @returns {string | undefined}
 */
export function mine_txpow_chunk_wasm(tx_body_bytes, txn_difficulty, time_milli, start_nonce, chunk_size) {
    const ptr0 = passArray8ToWasm0(tx_body_bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(txn_difficulty, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.mine_txpow_chunk_wasm(ptr0, len0, ptr1, len1, time_milli, start_nonce, chunk_size);
    let v3;
    if (ret[0] !== 0) {
        v3 = getStringFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v3;
}

/**
 * Mine a TxPoW by iterating the header nonce.
 * Returns JSON: { minedHeaderBytes: hex, txpowId: hex, nonce: string, iterations: string }
 * @param {Uint8Array} tx_body_bytes
 * @param {Uint8Array} txn_difficulty
 * @param {number} time_milli
 * @param {number} max_iterations
 * @returns {string}
 */
export function mine_txpow_wasm(tx_body_bytes, txn_difficulty, time_milli, max_iterations) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passArray8ToWasm0(tx_body_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(txn_difficulty, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.mine_txpow_wasm(ptr0, len0, ptr1, len1, time_milli, max_iterations);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Build MMR tree from public key digests and return the root.
 * @param {Uint8Array} pubkeys_flat
 * @param {number} count
 * @returns {Uint8Array}
 */
export function mmr_root_from_public_keys_wasm(pubkeys_flat, count) {
    const ptr0 = passArray8ToWasm0(pubkeys_flat, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.mmr_root_from_public_keys_wasm(ptr0, len0, count);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Decode a Minima Mx address to bytes.
 * @param {string} address
 * @returns {Uint8Array}
 */
export function parse_mx_address_wasm(address) {
    const ptr0 = passStringToWasm0(address, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.parse_mx_address_wasm(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Convert BIP39 seed phrase to 32-byte seed (SHA3-256, no PBKDF2).
 * @param {string} phrase
 * @returns {Uint8Array}
 */
export function phrase_to_seed_wasm(phrase) {
    const ptr0 = passStringToWasm0(phrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.phrase_to_seed_wasm(ptr0, len0);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Precompute output coin IDs before transaction digest.
 * @param {Uint8Array} txid
 * @param {number} output_index
 * @returns {Uint8Array}
 */
export function precompute_transaction_coin_id_wasm(txid, output_index) {
    const ptr0 = passArray8ToWasm0(txid, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.precompute_transaction_coin_id_wasm(ptr0, len0, output_index);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Serialize a transaction for digest computation.
 * @param {string} tx_json
 * @returns {Uint8Array}
 */
export function serialize_transaction_wasm(tx_json) {
    const ptr0 = passStringToWasm0(tx_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.serialize_transaction_wasm(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * SHA3-256 hash of data.
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
export function sha3_256_wasm(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.sha3_256_wasm(ptr0, len0);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Constant-time comparison of two byte arrays.
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {boolean}
 */
export function timing_safe_equal_wasm(a, b) {
    const ptr0 = passArray8ToWasm0(a, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(b, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.timing_safe_equal_wasm(ptr0, len0, ptr1, len1);
    return ret !== 0;
}

/**
 * Validate a Sign-In With Wallet challenge.
 * @param {string} challenge_json
 * @param {string} domain
 * @returns {boolean}
 */
export function validate_challenge_wasm(challenge_json, domain) {
    const ptr0 = passStringToWasm0(challenge_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(domain, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.validate_challenge_wasm(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] !== 0;
}

/**
 * Validate a BIP39 mnemonic phrase.
 * @param {string} phrase
 * @returns {boolean}
 */
export function validate_phrase_wasm(phrase) {
    const ptr0 = passStringToWasm0(phrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.validate_phrase_wasm(ptr0, len0);
    return ret !== 0;
}

/**
 * Verify an MMR proof for a leaf public key.
 * @param {Uint8Array} leaf_pubkey
 * @param {string} proof_json
 * @param {Uint8Array} expected_root
 * @returns {boolean}
 */
export function verify_mmr_proof_wasm(leaf_pubkey, proof_json, expected_root) {
    const ptr0 = passArray8ToWasm0(leaf_pubkey, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(proof_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(expected_root, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.verify_mmr_proof_wasm(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] !== 0;
}

/**
 * Verify a tree signature (3-proof chain).
 * @param {Uint8Array} root_public_key
 * @param {Uint8Array} message
 * @param {string} signature_json
 * @returns {boolean}
 */
export function verify_tree_signature_wasm(root_public_key, message, signature_json) {
    const ptr0 = passArray8ToWasm0(root_public_key, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(signature_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.verify_tree_signature_wasm(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] !== 0;
}

/**
 * Free a WasmTreeKey.
 * @param {number} handle
 */
export function wasm_tree_key_free(handle) {
    wasm.wasm_tree_key_free(handle);
}

/**
 * Get the maximum number of signatures.
 * @param {number} handle
 * @returns {number}
 */
export function wasm_tree_key_get_max_uses(handle) {
    const ret = wasm.wasm_tree_key_get_max_uses(handle);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] >>> 0;
}

/**
 * Get the root public key (32 bytes).
 * @param {number} handle
 * @returns {Uint8Array}
 */
export function wasm_tree_key_get_public_key(handle) {
    const ret = wasm.wasm_tree_key_get_public_key(handle);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * Get current usage count.
 * @param {number} handle
 * @returns {number}
 */
export function wasm_tree_key_get_uses(handle) {
    const ret = wasm.wasm_tree_key_get_uses(handle);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] >>> 0;
}

/**
 * Create a new WasmTreeKey from a 32-byte seed.
 * Returns an opaque handle (index) for use with other wasm_tree_key_* functions.
 * The tree is stored in a global registry.
 * @param {Uint8Array} seed
 * @param {number} keys_per_level
 * @param {number} levels
 * @returns {number}
 */
export function wasm_tree_key_new(seed, keys_per_level, levels) {
    const ptr0 = passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_tree_key_new(ptr0, len0, keys_per_level, levels);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] >>> 0;
}

/**
 * Set the usage counter.
 * @param {number} handle
 * @param {number} uses
 */
export function wasm_tree_key_set_uses(handle, uses) {
    const ret = wasm.wasm_tree_key_set_uses(handle, uses);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

/**
 * Sign data with the current key and increment usage.
 * Returns JSON-serialized TreeSignature.
 * @param {number} handle
 * @param {Uint8Array} data
 * @returns {string}
 */
export function wasm_tree_key_sign(handle, data) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasm_tree_key_sign(handle, ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Derive Mx address from WOTS public key.
 * @param {Uint8Array} seed
 * @param {number} key_index
 * @returns {string}
 */
export function wots_address_from_keypair_wasm(seed, key_index) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wots_address_from_keypair_wasm(ptr0, len0, key_index);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Recover public key digest from signature.
 * @param {Uint8Array} message
 * @param {Uint8Array} signature
 * @returns {Uint8Array}
 */
export function wots_pk_from_sig_wasm(message, signature) {
    const ptr0 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(signature, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.wots_pk_from_sig_wasm(ptr0, len0, ptr1, len1);
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * Sign multiple messages with the same key index.
 * Returns flat concatenated signatures: [sig0(1088B), sig1(1088B), ...]
 * @param {Uint8Array} seed
 * @param {number} key_index
 * @param {Uint8Array} messages_flat
 * @param {number} count
 * @returns {Uint8Array}
 */
export function wots_sign_batch_wasm(seed, key_index, messages_flat, count) {
    const ptr0 = passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(messages_flat, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.wots_sign_batch_wasm(ptr0, len0, key_index, ptr1, len1, count);
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * Sign a message using WOTS. Returns 1088-byte signature.
 * @param {Uint8Array} seed
 * @param {number} key_index
 * @param {Uint8Array} message
 * @returns {Uint8Array}
 */
export function wots_sign_wasm(seed, key_index, message) {
    const ptr0 = passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.wots_sign_wasm(ptr0, len0, key_index, ptr1, len1);
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * Verify WOTS signature against 32-byte public key digest.
 * @param {Uint8Array} sig
 * @param {Uint8Array} message
 * @param {Uint8Array} pk_digest
 * @returns {boolean}
 */
export function wots_verify_digest_wasm(sig, message, pk_digest) {
    const ptr0 = passArray8ToWasm0(sig, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(pk_digest, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.wots_verify_digest_wasm(ptr0, len0, ptr1, len1, ptr2, len2);
    return ret !== 0;
}

/**
 * Verify WOTS signature against full 1088-byte public key.
 * @param {Uint8Array} sig
 * @param {Uint8Array} message
 * @param {Uint8Array} pk_full
 * @returns {boolean}
 */
export function wots_verify_wasm(sig, message, pk_full) {
    const ptr0 = passArray8ToWasm0(sig, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(pk_full, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.wots_verify_wasm(ptr0, len0, ptr1, len1, ptr2, len2);
    return ret !== 0;
}

/**
 * Write MiniData (Java-compatible serialization).
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
export function write_mini_data_wasm(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.write_mini_data_wasm(ptr0, len0);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Write MiniNumber (Java-compatible serialization).
 * @param {bigint} value
 * @param {number} scale
 * @returns {Uint8Array}
 */
export function write_mini_number_wasm(value, scale) {
    const ret = wasm.write_mini_number_wasm(value, scale);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * Write MiniString (Java-compatible serialization).
 * @param {string} s
 * @returns {Uint8Array}
 */
export function write_mini_string_wasm(s) {
    const ptr0 = passStringToWasm0(s, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.write_mini_string_wasm(ptr0, len0);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}
export function __wbg___wbindgen_debug_string_c25d447a39f5578f(arg0, arg1) {
    const ret = debugString(arg1);
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg___wbindgen_is_function_1ff95bcc5517c252(arg0) {
    const ret = typeof(arg0) === 'function';
    return ret;
}
export function __wbg___wbindgen_is_object_a27215656b807791(arg0) {
    const val = arg0;
    const ret = typeof(val) === 'object' && val !== null;
    return ret;
}
export function __wbg___wbindgen_is_string_ea5e6cc2e4141dfe(arg0) {
    const ret = typeof(arg0) === 'string';
    return ret;
}
export function __wbg___wbindgen_is_undefined_c05833b95a3cf397(arg0) {
    const ret = arg0 === undefined;
    return ret;
}
export function __wbg___wbindgen_throw_344f42d3211c4765(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
}
export function __wbg_call_a6e5c5dce5018821() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.call(arg1, arg2);
    return ret;
}, arguments); }
export function __wbg_crypto_38df2bab126b63dc(arg0) {
    const ret = arg0.crypto;
    return ret;
}
export function __wbg_error_a6fa202b58aa1cd3(arg0, arg1) {
    let deferred0_0;
    let deferred0_1;
    try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm0(arg0, arg1));
    } finally {
        wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
    }
}
export function __wbg_getRandomValues_c44a50d8cfdaebeb() { return handleError(function (arg0, arg1) {
    arg0.getRandomValues(arg1);
}, arguments); }
export function __wbg_length_1f0964f4a5e2c6d8(arg0) {
    const ret = arg0.length;
    return ret;
}
export function __wbg_msCrypto_bd5a034af96bcba6(arg0) {
    const ret = arg0.msCrypto;
    return ret;
}
export function __wbg_new_227d7c05414eb861() {
    const ret = new Error();
    return ret;
}
export function __wbg_new_da52cf8fe3429cb2() {
    const ret = new Object();
    return ret;
}
export function __wbg_new_with_length_e6785c33c8e4cce8(arg0) {
    const ret = new Uint8Array(arg0 >>> 0);
    return ret;
}
export function __wbg_node_84ea875411254db1(arg0) {
    const ret = arg0.node;
    return ret;
}
export function __wbg_process_44c7a14e11e9f69e(arg0) {
    const ret = arg0.process;
    return ret;
}
export function __wbg_prototypesetcall_4770620bbe4688a0(arg0, arg1, arg2) {
    Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
}
export function __wbg_randomFillSync_6c25eac9869eb53c() { return handleError(function (arg0, arg1) {
    arg0.randomFillSync(arg1);
}, arguments); }
export function __wbg_require_b4edbdcf3e2a1ef0() { return handleError(function () {
    const ret = module.require;
    return ret;
}, arguments); }
export function __wbg_set_8535240470bf2500() { return handleError(function (arg0, arg1, arg2) {
    const ret = Reflect.set(arg0, arg1, arg2);
    return ret;
}, arguments); }
export function __wbg_stack_3b0d974bbf31e44f(arg0, arg1) {
    const ret = arg1.stack;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg_static_accessor_GLOBAL_4ef717fb391d88b7() {
    const ret = typeof global === 'undefined' ? null : global;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_static_accessor_GLOBAL_THIS_8d1badc68b5a74f4() {
    const ret = typeof globalThis === 'undefined' ? null : globalThis;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_static_accessor_SELF_146583524fe1469b() {
    const ret = typeof self === 'undefined' ? null : self;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_static_accessor_WINDOW_f2829a2234d7819e() {
    const ret = typeof window === 'undefined' ? null : window;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_subarray_3ed232c8a6baee09(arg0, arg1, arg2) {
    const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
    return ret;
}
export function __wbg_versions_276b2795b1c6a219(arg0) {
    const ret = arg0.versions;
    return ret;
}
export function __wbindgen_cast_0000000000000001(arg0) {
    // Cast intrinsic for `F64 -> Externref`.
    const ret = arg0;
    return ret;
}
export function __wbindgen_cast_0000000000000002(arg0, arg1) {
    // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
    const ret = getArrayU8FromWasm0(arg0, arg1);
    return ret;
}
export function __wbindgen_cast_0000000000000003(arg0, arg1) {
    // Cast intrinsic for `Ref(String) -> Externref`.
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
}
export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_externrefs;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
}
function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;


let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}
