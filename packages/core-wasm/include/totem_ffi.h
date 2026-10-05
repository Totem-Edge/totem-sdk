/* totem_ffi.h — RFC-033 native C ABI over the Totem core WOTS/TreeKey crypto.
 *
 * Buffers returned via out-pointer are owned by the caller and MUST be freed
 * with totem_free(ptr, len). Strings are freed with totem_string_free(ptr).
 * Functions fail closed: null / 0 on error.
 */
#ifndef TOTEM_FFI_H
#define TOTEM_FFI_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Memory */
void totem_free(uint8_t* ptr, size_t len);
void totem_string_free(char* ptr);

/* Hashing */
uint8_t* totem_sha3_256(const uint8_t* data, size_t len, size_t* out_len);

/* Flat WOTS */
uint8_t* totem_wots_sign(const uint8_t* seed, size_t seed_len, uint32_t index,
                         const uint8_t* message, size_t message_len, size_t* out_len);
int totem_wots_verify_digest(const uint8_t* sig, size_t sig_len,
                             const uint8_t* message, size_t message_len,
                             const uint8_t* pk_digest, size_t pk_digest_len);
int totem_wots_verify(const uint8_t* sig, size_t sig_len,
                      const uint8_t* message, size_t message_len,
                      const uint8_t* pk_full, size_t pk_full_len);
uint8_t* totem_derive_pk_digest(const uint8_t* seed, size_t seed_len, uint32_t index, size_t* out_len);
uint8_t* totem_derive_full_public_key(const uint8_t* seed, size_t seed_len, uint32_t index, size_t* out_len);
uint8_t* totem_wots_address_from_keypair(const uint8_t* seed, size_t seed_len, uint32_t index, size_t* out_len);
int totem_timing_safe_equal(const uint8_t* a, size_t a_len, const uint8_t* b, size_t b_len);

/* TreeKey (hierarchical, stateful handle) */
uint32_t totem_treekey_new(const uint8_t* seed, size_t seed_len,
                           uint32_t keys_per_level, uint32_t levels, char** err_out);
uint8_t* totem_treekey_sign(uint32_t handle, const uint8_t* data, size_t data_len, size_t* out_len);
uint8_t* totem_treekey_get_public_key(uint32_t handle, size_t* out_len);
uint32_t totem_treekey_get_uses(uint32_t handle);
void totem_treekey_set_uses(uint32_t handle, uint32_t uses);
uint32_t totem_treekey_get_max_uses(uint32_t handle);
void totem_treekey_free(uint32_t handle);

/* Java-Streamable TreeSignature serialization */
uint8_t* totem_tree_signature_serialize(const char* sig_json, size_t* out_len, char** err_out);
uint8_t* totem_tree_signature_deserialize(const uint8_t* bytes, size_t len, size_t* out_len, char** err_out);
int totem_verify_tree_signature_json(const uint8_t* root_pk, size_t root_pk_len,
                                     const uint8_t* message, size_t message_len,
                                     const char* sig_json);

/* Key derivation (Minima parity) */
uint8_t* totem_derive_root_priv_seed(const uint8_t* seed, size_t seed_len, size_t* out_len);
uint8_t* totem_derive_unified_child_seed(const uint8_t* base_seed, size_t base_seed_len, uint32_t index, size_t* out_len);
uint8_t* totem_derive_per_address_seed(const uint8_t* root_seed, size_t root_seed_len, uint32_t address_index, size_t* out_len);

/* Unified root/child TreeKey factories (TS createUnified*TreeKey parity) */
uint32_t totem_create_unified_root_tree_key(const uint8_t* base_seed, size_t base_seed_len, char** err_out);
uint32_t totem_create_unified_child_tree_key(const uint8_t* base_seed, size_t base_seed_len, uint32_t index, char** err_out);

/* Address derivation from a WOTS public key (TS scriptFromWotsPk → scriptToAddress) */
uint8_t* totem_address_from_pk_digest(const uint8_t* pk_digest, size_t pk_digest_len, size_t* out_len);
uint8_t* totem_address_from_full_public_key(const uint8_t* pk_full, size_t pk_full_len, size_t* out_len);

/* Utility */
uint8_t* totem_write_mini_data(const uint8_t* data, size_t len, size_t* out_len);

#ifdef __cplusplus
}
#endif
#endif /* TOTEM_FFI_H */
