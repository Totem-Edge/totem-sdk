/* @ts-self-types="./totemsdk_core_wasm.d.ts" */
import * as wasm from "./totemsdk_core_wasm_bg.wasm";
import { __wbg_set_wasm } from "./totemsdk_core_wasm_bg.js";

__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    bytes_to_hex_wasm, clean_seed_phrase_wasm, compute_transaction_digest_wasm, concat_bytes_wasm, create_challenge_wasm, create_unified_child_tree_key_wasm, create_unified_root_tree_key_wasm, derive_chain_seed_wasm, derive_full_public_key_batch_wasm, derive_full_public_key_wasm, derive_per_address_seed_wasm, derive_pk_digest_batch_wasm, derive_pk_digest_wasm, derive_root_priv_seed_wasm, derive_unified_address_public_key_wasm, expand_private_key_wasm, generate_mnemonic_wasm, get_params, hash_chain_wasm, hex_to_bytes_wasm, init, make_mx_address_wasm, mine_txpow_chunk_wasm, mine_txpow_wasm, mmr_root_from_public_keys_wasm, parse_mx_address_wasm, phrase_to_seed_wasm, precompute_transaction_coin_id_wasm, serialize_transaction_wasm, sha3_256_wasm, timing_safe_equal_wasm, validate_challenge_wasm, validate_phrase_wasm, verify_mmr_proof_wasm, verify_tree_signature_wasm, wasm_tree_key_free, wasm_tree_key_get_max_uses, wasm_tree_key_get_public_key, wasm_tree_key_get_uses, wasm_tree_key_new, wasm_tree_key_set_uses, wasm_tree_key_sign, wots_address_from_keypair_wasm, wots_pk_from_sig_wasm, wots_sign_batch_wasm, wots_sign_wasm, wots_verify_digest_wasm, wots_verify_wasm, write_mini_data_wasm, write_mini_number_wasm, write_mini_string_wasm
} from "./totemsdk_core_wasm_bg.js";
