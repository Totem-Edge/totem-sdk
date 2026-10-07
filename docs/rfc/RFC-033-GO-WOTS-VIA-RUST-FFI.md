# RFC-033: Byte-Exact WOTS for the Go Mirrors via Rust FFI

**Status:** Landed — C-ABI FFI + Go cgo binding (`packages/core/go`); lookup-client/lookup-node defaults wired (client signs from `IdentitySeed`, node verifies by default); se-server Go uses the RFC-008 leased identity. Bidirectional TS⇄Go interop tests green (auth envelope + TreeSignature + flat SE signature + unified/per-address derivation). Go 10/10 modules; TS lookup/se-server suites green.
**Created:** 2026-10-05
**Authors:** Totem SDK Contributors
**Depends on:** RFC-009 (TreeKey signature fidelity), RFC-031 (core-wasm sole implementation), RFC-032 (lookup post-quantum identity)
**Touches:** `@totemsdk/core-wasm` (Rust), `packages/*/go` (new cgo binding), `lookup-client/go`, `lookup-node/go`, `se-server/go`

---

## 1. Summary

The Go mirrors (`packages/lookup-*/go`, `packages/se-server/go`) currently **fail closed** on WOTS (`ErrNotInteroperable`, AUD-045): they must never emit placeholder cryptography. This RFC gives them a **byte-exact WOTS/TreeKey stack** by **reusing the existing pure-Rust implementation** in `@totemsdk/core-wasm` through a C-ABI static library linked from Go via cgo — rather than hand-porting the crypto to Go.

The Rust crypto (`wots.rs`, `mmr.rs`, `treekey.rs`, `java_streamables.rs`, `streamable.rs`) is already byte-exact with Minima/Java and cross-language tested (`core-wasm/tests/java_parity.rs`, `core/test-vectors/java-parity/`, `wots-parity.test.ts`). It contains **no** `wasm_bindgen`/`js_sys` coupling in those modules and compiles+runs on native targets (verified). Reimplementing it in Go would be the riskier path to the same goal.

## 2. Motivation

### 2.1 The gap

- `packages/se-server/go/sekey.go`: `seSign`/`wotsVerifyDigest` return `ErrNotInteroperable`.
- `packages/lookup-*/go`: WOTS signer/verifier fail closed (added in RFC-032).
- A byte divergence anywhere (GMSSRandom, checksum extraction, MMR node hashing, Streamable serialization) yields signatures that do not verify cross-language — the worst failure mode for a signature system.

### 2.2 Why reuse, not reimplement

| Concern | Hand-port to Go | **Rust FFI reuse** |
|---|---|---|
| Byte-exactness risk | High (subtle serialization/PRNG bugs) | **None** — same tested code |
| New crypto code | ~1.6–3.2k lines | ~200 lines C ABI + bindings |
| Provenance | New, unproven | Already Java-parity tested |
| Build cost | Pure Go | cargo + cgo native lib |

The Rust crate is already `crate-type = ["cdylib", "rlib"]`; adding `staticlib` + a C ABI is small.

## 3. Goals

1. Byte-exact WOTS sign/verify, `derive_pk_digest`, `derive_full_public_key`, TreeKey sign/verify, and Java-`Streamable` TreeSignature/Proof serialization, callable from Go.
2. Cross-language parity proven against the committed Java/TS golden vectors and by verifying a TS-produced signature in Go (and vice-versa).
3. Replace `ErrNotInteroperable` in `se-server/go`; make the lookup Go mirrors actually sign/verify.
4. Keep the Go packages building via `verify-go.mjs` and CI.

## 4. Non-goals

- Porting the *entire* core to Go — only the WOTS/TreeKey/MMR/serialization surface the mirrors use.
- Removing the WASM build (RFC-031 keeps core-wasm the JS engine; the staticlib is an additional artifact).
- Replacing TypeScript as the primary implementation.

## 5. Design

### 5.1 FFI crate & C ABI

Add `staticlib` to `packages/core-wasm/Cargo.toml` and a native-only `src/ffi.rs` (cfg-gated `not(target_arch = "wasm32")`) exposing a small, allocation-safe C ABI:

```c
// All returned buffers are caller-freed via totem_free(ptr, len).
uint8_t* totem_sha3_256(const uint8_t* data, size_t len, size_t* out_len);
uint8_t* totem_wots_sign(const uint8_t* seed, size_t seed_len, uint32_t index,
                         const uint8_t* msg, size_t msg_len, size_t* out_len);
int      totem_wots_verify_digest(const uint8_t* sig, const uint8_t* msg, const uint8_t* pk_digest);
int      totem_wots_verify(const uint8_t* sig, const uint8_t* msg, const uint8_t* pk_full);
uint8_t* totem_derive_pk_digest(const uint8_t* seed, uint32_t index, size_t* out_len);
uint8_t* totem_derive_full_public_key(const uint8_t* seed, uint32_t index, size_t* out_len);
uint8_t* totem_wots_address_from_keypair(const uint8_t* seed, uint32_t index, size_t* out_len);

// TreeKey (hierarchical) — opaque handle, mirroring wasm_tree.rs.
uint32_t totem_treekey_new(const uint8_t* seed, size_t seed_len, uint32_t keys_per_level, uint32_t levels, char** err);
int      totem_treekey_sign(uint32_t handle, const uint8_t* data, size_t len, uint8_t** sig_json, size_t* out_len);
uint8_t* totem_treekey_get_public_key(uint32_t handle, size_t* out_len);
void     totem_treekey_set_uses(uint32_t handle, uint32_t uses);
uint32_t totem_treekey_get_uses(uint32_t handle);
void     totem_treekey_free(uint32_t handle);

// Java-Streamable TreeSignature serialization (byte-exact with TS writeSignature()).
uint8_t* totem_tree_signature_serialize(const char* sig_json, size_t* out_len, char** err);
uint8_t* totem_tree_signature_deserialize(const uint8_t* bytes, size_t len, size_t* out_len, char** err);
uint8_t* totem_verify_tree_signature_json(const uint8_t* root_pk, const uint8_t* msg,
                                          const char* sig_json, size_t msg_len);

void     totem_free(void* ptr, size_t len);
void     totem_string_free(char* ptr);
```

- The `TreeSignature` JSON is the same shape `treekey.rs` already emits (`{ proofs: [{ leafPubkey, signature, mmrProof: { chunks: [{ isLeft, mmrData: { data, value } }] } }] }`), so Go and TS exchange identical structures.
- `totem_tree_signature_serialize` implements Java `Signature.writeDataStream()` (the TS `writeSignature()` path: MiniNumber proof count, then per-proof MiniData(pubkey)+MiniData(signature)+MMRProof) — currently missing in Rust, added here.

### 5.2 Go binding

A small cgo package `packages/lookup-protocol/go/totemcrypto` (shared by all Go mirrors):

```go
// #cgo CFLAGS: -I${SRCDIR}/../../../../native/core-ffi/include
// #cgo LDFLAGS: -L${SRCDIR}/../../../../native/core-ffi/lib -ltotemsdk_core_ffi
// #include "totem_ffi.h"
import "C"
```

- `Sign(seed, index, message) []byte`, `VerifyDigest(sig, msg, pkDigest) bool`, `DerivePKDigest`, `TreeKeySign/Verify`, `SerializeTreeSignature`.
- The static lib is built by `scripts/build-core-ffi.sh` (cargo) before `go build`; `verify-go.mjs` builds it first.

### 5.3 Wiring

- **`se-server/go`**: `seSign`/`wotsVerifyDigest` call the binding; delete `ErrNotInteroperable` (keep the type for compatibility but no longer returned from these paths).
- **`lookup-node/go`**: `WotsVerifier` implementation over `VerifyDigest`/`VerifyTreeSignature`; the node can now authenticate real client envelopes.
- **`lookup-client/go`**: `WotsSigner` over `Sign` (flat) or TreeKey sign, replacing the fail-closed default.

### 5.4 Serialization parity

The one piece Rust lacks is Java `Streamable` serialization of a `TreeSignature`. It is added in `ffi.rs` (or a shared `signature_streamable.rs`) using the existing `streamable.rs` primitives (`write_mini_number`, `write_mini_data`, MMR chunk serialization), matching TS `writeSignature`/`writeSignatureProof`/`writeMMRProof` byte-for-byte.

## 6. Compatibility

- Additive: a new staticlib artifact + C ABI; the WASM build is unchanged (`ffi` is cfg-gated off for `wasm32`).
- Go packages gain a native-library build dependency (cargo + a C toolchain), gated in `verify-go.mjs`; the pure-Go `go build` path still works where the lib is prebuilt.
- No change to TS/JS behavior or the on-wire protocol.

## 7. Security considerations

| Case | Behaviour |
|---|---|
| Byte divergence from Java | Eliminated by reuse; guarded by golden-vector + cross-language KAT tests in CI. |
| Memory safety across FFI | Every C-ABI fn is bounds-checked, returns owned buffers, and panics are caught at the boundary (`catch_unwind`) → error code, never UB. |
| Key material in FFI buffers | Caller frees via `totem_free`; seed buffers are not logged. |
| Wrong-length inputs | Return 0/null rather than reading OOB. |
| Fail-closed preserved | If the native lib is absent, Go bindings return an error (as today), never a placeholder. |

## 8. Phases

| Phase | Work | Gate |
|---|---|---|
| **P0** | This RFC; freeze the C ABI + Go binding surface. | — |
| **P1** | `ffi.rs` + `staticlib` crate-type; `build-core-ffi.sh`; Go `totemcrypto` binding. | Go signs; `wotsVerifyDigest` of a self-sig true |
| **P2** | Streamable TreeSignature serialize/deserialize in Rust. | Bytes equal TS `writeSignature()` on a fixture |
| **P3** | Wire `se-server/go` (remove fail-closed). | Go SE sig verifies in TS; TS SE sig verifies in Go |
| **P4** | Wire `lookup-node/go` verifier + `lookup-client/go` signer. | Go client signs an envelope the TS node accepts; TS client envelope accepted by Go node |
| **P5** | Parity suite: all `wots-pkdigest.json` / golden vectors in Go; cross-language KAT. | vectors green |
| **P6** | CI (`verify-go.mjs` builds the lib), docs. | green |

## 9. Open questions

- **Q1** Ship prebuilt static libs per platform, or require `cargo` in the Go build? (Start with build-from-source.)
- **Q2** Keep the FFI crate inside `core-wasm` (proposed) or a separate `packages/core-ffi`?
- **Q3** TreeKey signing is stateful (uses counter): the Go binding mirrors `set_uses`/`get_uses`; persistence stays the caller's concern (as in TS).
- **Q4** Do the Go mirrors need the full TreeKey hierarchy, or is flat WOTS + `derive_pk_digest` sufficient for their current surfaces?

## 10. References

- `docs/rfc/RFC-009-KISSVM-SIGNATURE-FIDELITY.md`, `RFC-031-CORE-WASM-SOLE-IMPLEMENTATION.md`, `RFC-032-LOOKUP-STACK-POST-QUANTUM-IDENTITY.md`
- `packages/core-wasm/src/{wots,mmr,treekey,java_streamables,streamable}.rs`
- `packages/core/src/{wots,Streamable}.ts`, `packages/core/test-vectors/java-parity/`
- `packages/se-server/go/sekey.go` (AUD-045), `packages/lookup-*/go`
