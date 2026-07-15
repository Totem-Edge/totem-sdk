/**
 * Synchronous WASM bridge — thin wrappers around @totemsdk/core-wasm.
 *
 * All functions are synchronous. The WASM module is initialized at import time.
 * This replaces the async bridge in wasm-bridge.ts with zero-overhead calls.
 *
 * Usage:
 *   import { wotsSign, sha3_256 } from '@totemsdk/core/wasm';
 *   const sig = wotsSign(seed, 0, message); // synchronous!
 */

// The bundler target initializes WASM synchronously at import time.
// The nodejs target uses require() which is also synchronous.
// Both targets export functions that are ready to call immediately.
import {
  bytes_to_hex_wasm,
  clean_seed_phrase_wasm,
  compute_transaction_digest_wasm,
  concat_bytes_wasm,
  create_challenge_wasm,
  create_unified_child_tree_key_wasm,
  create_unified_root_tree_key_wasm,
  derive_chain_seed_wasm,
  derive_full_public_key_batch_wasm,
  derive_full_public_key_wasm,
  derive_per_address_seed_wasm,
  derive_pk_digest_batch_wasm,
  derive_pk_digest_wasm,
  derive_root_priv_seed_wasm,
  derive_unified_address_public_key_wasm,
  expand_private_key_wasm,
  generate_mnemonic_wasm,
  get_params,
  hash_chain_wasm,
  hex_to_bytes_wasm,
  make_mx_address_wasm,
  mine_txpow_chunk_wasm,
  mine_txpow_wasm,
  mmr_root_from_public_keys_wasm,
  parse_mx_address_wasm,
  phrase_to_seed_wasm,
  precompute_transaction_coin_id_wasm,
  serialize_transaction_wasm,
  sha3_256_wasm,
  timing_safe_equal_wasm,
  validate_challenge_wasm,
  validate_phrase_wasm,
  verify_mmr_proof_wasm,
  verify_tree_signature_wasm,
  wasm_tree_key_free,
  wasm_tree_key_get_max_uses,
  wasm_tree_key_get_public_key,
  wasm_tree_key_get_uses,
  wasm_tree_key_new,
  wasm_tree_key_set_uses,
  wasm_tree_key_sign,
  wots_address_from_keypair_wasm,
  wots_pk_from_sig_wasm,
  wots_sign_batch_wasm,
  wots_sign_wasm,
  wots_verify_digest_wasm,
  wots_verify_wasm,
  write_mini_data_wasm,
  write_mini_number_wasm,
  write_mini_string_wasm,
} from '@totemsdk/core-wasm';

// ---------------------------------------------------------------------------
// Re-export with clean names matching the original @totemsdk/core API
// ---------------------------------------------------------------------------

export const bytesToHex = bytes_to_hex_wasm;
export const hexToBytes = hex_to_bytes_wasm;
export const concatBytes = concat_bytes_wasm;
export const sha3_256 = sha3_256_wasm;

export const expandPrivateKey = expand_private_key_wasm;
export const hashChain = hash_chain_wasm;
export const derivePKdigest = derive_pk_digest_wasm;
export const deriveFullPublicKey = derive_full_public_key_wasm;
export const wotsSign = wots_sign_wasm;
export const wotsVerify = wots_verify_wasm;
export const wotsVerifyDigest = wots_verify_digest_wasm;
export const wotsPkFromSig = wots_pk_from_sig_wasm;
export const wotsPublicKeyFromSeed = derive_pk_digest_wasm;

export const deriveChainSeedJava = derive_chain_seed_wasm;
export const derivePerAddressSeed = derive_per_address_seed_wasm;
export const deriveRootPrivSeed = derive_root_priv_seed_wasm;

export const phraseToSeed = phrase_to_seed_wasm;
export const generateWordList = generate_mnemonic_wasm;
export const validatePhrase = validate_phrase_wasm;
export const cleanSeedPhrase = clean_seed_phrase_wasm;

export const makeMxAddress = make_mx_address_wasm;
export const parseMxAddress = parse_mx_address_wasm;
export const wotsAddressFromKeypair = wots_address_from_keypair_wasm;

export const serializeTransaction = serialize_transaction_wasm;
export const computeTransactionDigest = compute_transaction_digest_wasm;
export const precomputeTransactionCoinID = precompute_transaction_coin_id_wasm;

export const verifyTreeSignature = verify_tree_signature_wasm;
export const timingSafeEqual = timing_safe_equal_wasm;
export const createChallenge = create_challenge_wasm;
export const validateChallenge = validate_challenge_wasm;

export const writeMiniNumber = write_mini_number_wasm;
export const writeMiniData = write_mini_data_wasm;
export const writeMiniString = write_mini_string_wasm;

export const createUnifiedChildTreeKey = create_unified_child_tree_key_wasm;
export const createUnifiedRootTreeKey = create_unified_root_tree_key_wasm;
export const deriveUnifiedAddressPublicKey = derive_unified_address_public_key_wasm;
export const mmrRootFromPublicKeys = mmr_root_from_public_keys_wasm;
export const verifyMMRProof = verify_mmr_proof_wasm;

export { get_params as getParams };

// ---------------------------------------------------------------------------
// Batch WOTS APIs
// ---------------------------------------------------------------------------

export const wotsSignBatch = wots_sign_batch_wasm;
export const derivePKdigestBatch = derive_pk_digest_batch_wasm;
export const deriveFullPublicKeyBatch = derive_full_public_key_batch_wasm;

// ---------------------------------------------------------------------------
// TxPoW Mining
// ---------------------------------------------------------------------------

export const mineTxPoW = mine_txpow_wasm;
export const mineTxPoWChunk = mine_txpow_chunk_wasm;

// ---------------------------------------------------------------------------
// Stateful WasmTreeKey
// ---------------------------------------------------------------------------

export const wasmTreeKeyNew = wasm_tree_key_new;
export const wasmTreeKeySign = wasm_tree_key_sign;
export const wasmTreeKeyGetPublicKey = wasm_tree_key_get_public_key;
export const wasmTreeKeyGetUses = wasm_tree_key_get_uses;
export const wasmTreeKeySetUses = wasm_tree_key_set_uses;
export const wasmTreeKeyGetMaxUses = wasm_tree_key_get_max_uses;
export const wasmTreeKeyFree = wasm_tree_key_free;

// ---------------------------------------------------------------------------
// Convenience: wotsKeypairFromSeed
// ---------------------------------------------------------------------------

export function wotsKeypairFromSeed(seed: Uint8Array, index: number): { seed: Uint8Array; index: number; pk: Uint8Array } {
  const pk = derive_pk_digest_wasm(seed, index);
  return { seed, index, pk };
}
