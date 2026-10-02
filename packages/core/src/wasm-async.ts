/**
 * Async-first WASM crypto entry (RFC-031 P1).
 *
 * Unlike `@totemsdk/core/wasm` (the synchronous bridge, which initializes WASM
 * at import time and therefore needs a synchronous `.wasm` module loader), this
 * entry targets the wasm-bindgen **web** artifact and requires a one-time async
 * init:
 *
 *   import { init, sha3_256, wotsSign } from '@totemsdk/core/wasm-async';
 *   await init();                 // or init({ module_or_path: wasmBytes/URL })
 *   const digest = sha3_256(data); // synchronous thereafter
 *
 * Portable to edge/Workers/browsers and stock bundlers: the glue has no
 * `import * as wasm from "./….wasm"`, no `fs`, and no `require`.
 *
 * ESM-only — the web target uses `import.meta.url`. CJS/Node consumers should
 * keep using the package root or `@totemsdk/core/legacy`.
 */

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
} from '@totemsdk/core-wasm/web';

// Async init (and the sync variant for environments that can supply a module).
export { default as init, initSync } from '@totemsdk/core-wasm/web';
export type { InitInput, InitOutput, SyncInitInput } from '@totemsdk/core-wasm/web';

// ---------------------------------------------------------------------------
// Re-export with the same clean names as @totemsdk/core (post-init)
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

export function wotsAddressFromKeypair(seed: Uint8Array, index: number): string;
export function wotsAddressFromKeypair(kp: { seed: Uint8Array; index: number }): string;
export function wotsAddressFromKeypair(
  seedOrKp: Uint8Array | { seed: Uint8Array; index: number },
  index?: number,
): string {
  if (seedOrKp instanceof Uint8Array) {
    return wots_address_from_keypair_wasm(seedOrKp, index!);
  }
  return wots_address_from_keypair_wasm(seedOrKp.seed, seedOrKp.index);
}

export const serializeTransaction = serialize_transaction_wasm;
export const computeTransactionDigest = compute_transaction_digest_wasm;
export const precomputeTransactionCoinID = precompute_transaction_coin_id_wasm;

export const verifyTreeSignature = verify_tree_signature_wasm;
export const timingSafeEqual = timing_safe_equal_wasm;
// SystemTime panics on wasm32-unknown-unknown; supply the clock from JS.
export function createChallenge(domain: string, statement: string): string {
  return create_challenge_wasm(domain, statement, Math.floor(Date.now() / 1000));
}
export function validateChallenge(challengeJson: string, domain: string): boolean {
  return validate_challenge_wasm(challengeJson, domain, Math.floor(Date.now() / 1000));
}

export function writeMiniNumber(value: bigint, scale = 0): Uint8Array {
  return write_mini_number_wasm(value.toString(), scale);
}
export const writeMiniData = write_mini_data_wasm;
export const writeMiniString = write_mini_string_wasm;

export const createUnifiedChildTreeKey = create_unified_child_tree_key_wasm;
export const createUnifiedRootTreeKey = create_unified_root_tree_key_wasm;
export const deriveUnifiedAddressPublicKey = derive_unified_address_public_key_wasm;
export const mmrRootFromPublicKeys = mmr_root_from_public_keys_wasm;
export const verifyMMRProof = verify_mmr_proof_wasm;

export { get_params as getParams };

export const wotsSignBatch = wots_sign_batch_wasm;
export const derivePKdigestBatch = derive_pk_digest_batch_wasm;
export const deriveFullPublicKeyBatch = derive_full_public_key_batch_wasm;

export const mineTxPoW = mine_txpow_wasm;
export const mineTxPoWChunk = mine_txpow_chunk_wasm;

export const wasmTreeKeyNew = wasm_tree_key_new;
export const wasmTreeKeySign = wasm_tree_key_sign;
export const wasmTreeKeyGetPublicKey = wasm_tree_key_get_public_key;
export const wasmTreeKeyGetUses = wasm_tree_key_get_uses;
export const wasmTreeKeySetUses = wasm_tree_key_set_uses;
export const wasmTreeKeyGetMaxUses = wasm_tree_key_get_max_uses;
export const wasmTreeKeyFree = wasm_tree_key_free;

export function wotsKeypairFromSeed(
  seed: Uint8Array,
  index: number,
): { seed: Uint8Array; index: number; pk: Uint8Array } {
  const pk = derive_pk_digest_wasm(seed, index);
  return { seed, index, pk };
}
