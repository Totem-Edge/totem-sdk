import { createHash } from 'node:crypto';

export function sha3_256_wasm(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha3-256').update(data).digest());
}

export function bytes_to_hex_wasm(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function hex_to_bytes_wasm(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex.replace(/^0x/i, ''), 'hex'));
}

export function concat_bytes_wasm(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function wots_sign_wasm(_seed: Uint8Array, _keyIndex: number, _message: Uint8Array): Uint8Array {
  return new Uint8Array(1088);
}

export function wots_verify_digest_wasm(_sig: Uint8Array, _message: Uint8Array, _pkDigest: Uint8Array): boolean {
  return true;
}

export function derive_pk_digest_wasm(_seed: Uint8Array, _keyIndex: number): Uint8Array {
  return new Uint8Array(32);
}

export function expand_private_key_wasm(_seed: Uint8Array): Uint8Array {
  return new Uint8Array(32);
}

export function hash_chain_wasm(_x: Uint8Array, _rounds: number): Uint8Array {
  return new Uint8Array(32);
}

export function derive_full_public_key_wasm(_seed: Uint8Array, _keyIndex: number): Uint8Array {
  return new Uint8Array(32);
}

export function wots_verify_wasm(_sig: Uint8Array, _message: Uint8Array, _pkFull: Uint8Array): boolean {
  return false;
}

export function wots_pk_from_sig_wasm(_message: Uint8Array, _signature: Uint8Array): Uint8Array {
  return new Uint8Array(32);
}

export function derive_chain_seed_wasm(_seed: Uint8Array, _keyIndex: number): Uint8Array {
  return new Uint8Array(32);
}

export function derive_per_address_seed_wasm(_rootSeed: Uint8Array, _addressIndex: number): Uint8Array {
  return new Uint8Array(32);
}

export function derive_root_priv_seed_wasm(_seed: Uint8Array): Uint8Array {
  return new Uint8Array(32);
}

export function phrase_to_seed_wasm(_phrase: string): Uint8Array {
  return new Uint8Array(32);
}

export function generate_mnemonic_wasm(): string {
  return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
}

export function validate_phrase_wasm(_phrase: string): boolean {
  return true;
}

export function clean_seed_phrase_wasm(_phrase: string): string {
  return '';
}

export function make_mx_address_wasm(_pk: Uint8Array): string {
  return 'Mx00';
}

export function parse_mx_address_wasm(_addr: string): Uint8Array {
  return new Uint8Array(32);
}

export function wots_address_from_keypair_wasm(_seed: Uint8Array, _index: number): string {
  return 'Mx00';
}

export function serialize_transaction_wasm(_tx: any): Uint8Array {
  return new Uint8Array(0);
}

export function compute_transaction_digest_wasm(_tx: any): Uint8Array {
  return new Uint8Array(32);
}

export function precompute_transaction_coin_id_wasm(_tx: any): string {
  return '0x00';
}

export function verify_tree_signature_wasm(_sig: Uint8Array, _msg: Uint8Array, _pk: Uint8Array): boolean {
  return false;
}

export function timing_safe_equal_wasm(_a: Uint8Array, _b: Uint8Array): boolean {
  return false;
}

export function create_challenge_wasm(): Uint8Array {
  return new Uint8Array(32);
}

export function validate_challenge_wasm(_challenge: Uint8Array, _response: Uint8Array): boolean {
  return false;
}

export function write_mini_number_wasm(_n: number): Uint8Array {
  return new Uint8Array(0);
}

export function write_mini_data_wasm(_data: Uint8Array): Uint8Array {
  return new Uint8Array(0);
}

export function write_mini_string_wasm(_s: string): Uint8Array {
  return new Uint8Array(0);
}

export function create_unified_child_tree_key_wasm(_seed: Uint8Array, _path: number[]): any {
  return {};
}

export function create_unified_root_tree_key_wasm(_seed: Uint8Array): any {
  return {};
}

export function derive_unified_address_public_key_wasm(_treeKey: any, _addressIndex: number): Uint8Array {
  return new Uint8Array(32);
}

export function mmr_root_from_public_keys_wasm(_keys: Uint8Array[]): Uint8Array {
  return new Uint8Array(32);
}

export function verify_mmr_proof_wasm(_leaf: Uint8Array, _root: Uint8Array, _proof: Uint8Array[]): boolean {
  return false;
}

export function get_params(): any {
  return {};
}

export function wots_sign_batch_wasm(_seed: Uint8Array, _indices: number[], _messages: Uint8Array[]): Uint8Array[] {
  return [];
}

export function derive_pk_digest_batch_wasm(_seed: Uint8Array, _indices: number[]): Uint8Array[] {
  return [];
}

export function derive_full_public_key_batch_wasm(_seed: Uint8Array, _indices: number[]): Uint8Array[] {
  return [];
}

export function mine_txpow_wasm(_header: Uint8Array, _target: Uint8Array, _startNonce: number, _chunkSize: number): number {
  return -1;
}

export function mine_txpow_chunk_wasm(_header: Uint8Array, _target: Uint8Array, _startNonce: number, _chunkSize: number): number {
  return -1;
}

export function wasm_tree_key_new(_seed: Uint8Array, _levels: number, _keysPerLevel: number): number {
  return 0;
}

export function wasm_tree_key_sign(_handle: number, _message: Uint8Array): Uint8Array {
  return new Uint8Array(0);
}

export function wasm_tree_key_get_public_key(_handle: number): Uint8Array {
  return new Uint8Array(32);
}

export function wasm_tree_key_get_uses(_handle: number): number {
  return 0;
}

export function wasm_tree_key_set_uses(_handle: number, _uses: number): void {}

export function wasm_tree_key_get_max_uses(_handle: number): number {
  return 0;
}

export function wasm_tree_key_free(_handle: number): void {}
