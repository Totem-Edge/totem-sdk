//! RFC-033: native C ABI over the pure-Rust WOTS/TreeKey/MMR crypto, for the Go
//! mirrors. Compiled only for non-wasm targets (see `lib.rs`).
//!
//! Every function returns owned memory the caller frees via [`totem_free`] /
//! [`totem_string_free`]. Panics are caught at the boundary and surface as a
//! null/`0` return so a bug can never unwind into Go (UB).
//!
//! Byte-exactness is inherited from the shared Rust implementation that already
//! passes Java parity (`core-wasm/tests/java_parity.rs`); this layer adds no new
//! crypto, only marshalling.

use std::panic::{catch_unwind, AssertUnwindSafe};
use std::slice;

use crate::streamable::{write_mini_byte, write_mini_data, write_mini_number};
use crate::treekey::{self, TreeSignature};
use crate::{utils, wots};

// ── Memory helpers ──────────────────────────────────────────────────────────

/// Leak a `Vec<u8>` to C, writing its length to `out_len`. Returns null on empty.
fn leak_bytes(mut v: Vec<u8>, out_len: *mut usize) -> *mut u8 {
    v.shrink_to_fit();
    let len = v.len();
    let ptr = v.as_mut_ptr();
    std::mem::forget(v);
    if !out_len.is_null() {
        unsafe { *out_len = len };
    }
    ptr
}

/// Free a buffer allocated by this module.
///
/// # Safety
/// `ptr`/`len` must come from a `totem_*` function in this module and be freed
/// exactly once.
#[no_mangle]
pub unsafe extern "C" fn totem_free(ptr: *mut u8, len: usize) {
    if ptr.is_null() || len == 0 {
        return;
    }
    drop(Vec::from_raw_parts(ptr, len, len));
}

/// Free a C string allocated by this module (e.g. error messages).
///
/// # Safety
/// `ptr` must come from a `totem_*` function returning `char*`.
#[no_mangle]
pub unsafe extern "C" fn totem_string_free(ptr: *mut std::os::raw::c_char) {
    if ptr.is_null() {
        return;
    }
    drop(std::ffi::CString::from_raw(ptr));
}

fn leak_cstring(s: String) -> *mut std::os::raw::c_char {
    match std::ffi::CString::new(s) {
        Ok(c) => c.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

unsafe fn cstr<'a>(p: *const std::os::raw::c_char) -> Option<&'a str> {
    if p.is_null() {
        return None;
    }
    std::ffi::CStr::from_ptr(p).to_str().ok()
}

unsafe fn as_slice<'a>(ptr: *const u8, len: usize) -> &'a [u8] {
    if ptr.is_null() || len == 0 {
        return &[];
    }
    slice::from_raw_parts(ptr, len)
}

// ── Hashing ─────────────────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn totem_sha3_256(data: *const u8, len: usize, out_len: *mut usize) -> *mut u8 {
    let data = unsafe { as_slice(data, len) };
    leak_bytes(wots_sha3(data), out_len)
}

fn wots_sha3(data: &[u8]) -> Vec<u8> {
    use sha3::{Digest, Sha3_256};
    let mut h = Sha3_256::new();
    h.update(data);
    h.finalize().to_vec()
}

// ── Flat WOTS ───────────────────────────────────────────────────────────────

/// Sign a 32-byte message with `wotsSign(seed, index, message)`.
#[no_mangle]
pub extern "C" fn totem_wots_sign(
    seed: *const u8,
    seed_len: usize,
    index: u32,
    message: *const u8,
    message_len: usize,
    out_len: *mut usize,
) -> *mut u8 {
    let seed = unsafe { as_slice(seed, seed_len) };
    let message = unsafe { as_slice(message, message_len) };
    match catch_unwind(AssertUnwindSafe(|| wots::wots_sign(seed, index, message))) {
        Ok(sig) => leak_bytes(sig, out_len),
        Err(_) => std::ptr::null_mut(),
    }
}

/// Verify a signature against a 32-byte public-key digest.
#[no_mangle]
pub extern "C" fn totem_wots_verify_digest(
    sig: *const u8,
    sig_len: usize,
    message: *const u8,
    message_len: usize,
    pk_digest: *const u8,
    pk_digest_len: usize,
) -> i32 {
    let sig = unsafe { as_slice(sig, sig_len) };
    let message = unsafe { as_slice(message, message_len) };
    let pk = unsafe { as_slice(pk_digest, pk_digest_len) };
    match catch_unwind(AssertUnwindSafe(|| {
        wots::wots_verify_digest(sig, message, pk)
    })) {
        Ok(true) => 1,
        _ => 0,
    }
}

/// Verify a signature against the full 1088-byte public key.
#[no_mangle]
pub extern "C" fn totem_wots_verify(
    sig: *const u8,
    sig_len: usize,
    message: *const u8,
    message_len: usize,
    pk_full: *const u8,
    pk_full_len: usize,
) -> i32 {
    let sig = unsafe { as_slice(sig, sig_len) };
    let message = unsafe { as_slice(message, message_len) };
    let pk = unsafe { as_slice(pk_full, pk_full_len) };
    match catch_unwind(AssertUnwindSafe(|| wots::wots_verify(sig, message, pk))) {
        Ok(true) => 1,
        _ => 0,
    }
}

#[no_mangle]
pub extern "C" fn totem_derive_pk_digest(
    seed: *const u8,
    seed_len: usize,
    index: u32,
    out_len: *mut usize,
) -> *mut u8 {
    let seed = unsafe { as_slice(seed, seed_len) };
    leak_bytes(wots::derive_pk_digest(seed, index), out_len)
}

#[no_mangle]
pub extern "C" fn totem_derive_full_public_key(
    seed: *const u8,
    seed_len: usize,
    index: u32,
    out_len: *mut usize,
) -> *mut u8 {
    let seed = unsafe { as_slice(seed, seed_len) };
    leak_bytes(wots::derive_full_public_key(seed, index), out_len)
}

/// Return the Minima `Mx...` address for `wotsAddressFromKeypair(seed, index)`.
#[no_mangle]
pub extern "C" fn totem_wots_address_from_keypair(
    seed: *const u8,
    seed_len: usize,
    index: u32,
    out_len: *mut usize,
) -> *mut u8 {
    let seed = unsafe { as_slice(seed, seed_len) };
    match catch_unwind(AssertUnwindSafe(|| {
        crate::script::wots_address_from_keypair(seed, index).map(|s| s.into_bytes())
    })) {
        Ok(Ok(bytes)) => leak_bytes(bytes, out_len),
        _ => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn totem_timing_safe_equal(a: *const u8, a_len: usize, b: *const u8, b_len: usize) -> i32 {
    let a = unsafe { as_slice(a, a_len) };
    let b = unsafe { as_slice(b, b_len) };
    if crate::verify::timing_safe_equal(a, b) { 1 } else { 0 }
}

// ── TreeKey (stateful handle) ────────────────────────────────────────────────

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use once_cell::sync::Lazy;

static HANDLES: Lazy<Mutex<HashMap<u32, treekey::TreeKey>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static NEXT_HANDLE: AtomicU32 = AtomicU32::new(1);

/// Create a TreeKey and return an opaque handle (0 on error).
#[no_mangle]
pub extern "C" fn totem_treekey_new(
    seed: *const u8,
    seed_len: usize,
    keys_per_level: u32,
    levels: u32,
    err_out: *mut *mut std::os::raw::c_char,
) -> u32 {
    let seed = unsafe { as_slice(seed, seed_len) };
    match treekey::TreeKey::new(seed, keys_per_level.max(2) as usize, levels.max(1) as usize) {
        Ok(tk) => {
            let handle = NEXT_HANDLE.fetch_add(1, Ordering::SeqCst);
            HANDLES.lock().unwrap().insert(handle, tk);
            handle
        }
        Err(e) => {
            if !err_out.is_null() {
                unsafe { *err_out = leak_cstring(e) };
            }
            0
        }
    }
}

/// Sign `data` with the TreeKey, returning the `TreeSignature` as JSON bytes.
#[no_mangle]
pub extern "C" fn totem_treekey_sign(
    handle: u32,
    data: *const u8,
    data_len: usize,
    out_len: *mut usize,
) -> *mut u8 {
    let data = unsafe { as_slice(data, data_len) };
    let mut guard = HANDLES.lock().unwrap();
    let Some(tk) = guard.get_mut(&handle) else {
        return std::ptr::null_mut();
    };
    match catch_unwind(AssertUnwindSafe(|| tk.sign(data))) {
        Ok(Ok(sig)) => match serde_json::to_vec(&sig) {
            Ok(bytes) => leak_bytes(bytes, out_len),
            Err(_) => std::ptr::null_mut(),
        },
        _ => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn totem_treekey_get_public_key(handle: u32, out_len: *mut usize) -> *mut u8 {
    let guard = HANDLES.lock().unwrap();
    match guard.get(&handle) {
        Some(tk) => leak_bytes(tk.get_public_key().to_vec(), out_len),
        None => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn totem_treekey_get_uses(handle: u32) -> u32 {
    HANDLES.lock().unwrap().get(&handle).map(|t| t.get_uses() as u32).unwrap_or(0)
}

#[no_mangle]
pub extern "C" fn totem_treekey_set_uses(handle: u32, uses: u32) {
    if let Some(tk) = HANDLES.lock().unwrap().get_mut(&handle) {
        tk.set_uses(uses as u64);
    }
}

#[no_mangle]
pub extern "C" fn totem_treekey_get_max_uses(handle: u32) -> u32 {
    HANDLES.lock().unwrap().get(&handle).map(|t| t.get_max_uses() as u32).unwrap_or(0)
}

#[no_mangle]
pub extern "C" fn totem_treekey_free(handle: u32) {
    HANDLES.lock().unwrap().remove(&handle);
}

// ── Java-Streamable TreeSignature serialization (RFC-033 §5.4) ───────────────

fn serialize_mmr_proof(proof: &crate::mmr::MMRProof) -> Vec<u8> {
    let mut out = Vec::new();
    // blockTime (MiniNumber, always 0 here) + array length (MiniNumber)
    out.extend_from_slice(&write_mini_number(0, 0));
    out.extend_from_slice(&write_mini_number(proof.chunks.len() as i64, 0));
    for chunk in &proof.chunks {
        // MiniByte(isLeft) + MMRData(hash MiniData + sum MiniNumber)
        out.extend_from_slice(&write_mini_byte(if chunk.is_left { 1 } else { 0 }));
        out.extend_from_slice(&write_mini_data(&chunk.mmr_data.data));
        out.extend_from_slice(&write_mini_number(chunk.mmr_data.value as i64, 0));
    }
    out
}

fn serialize_signature_proof(proof: &treekey::SignatureProof) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&write_mini_data(&proof.leaf_pubkey));
    out.extend_from_slice(&write_mini_data(&proof.signature));
    out.extend_from_slice(&serialize_mmr_proof(&proof.mmr_proof));
    out
}

/// Serialize a `TreeSignature` (JSON) to Java `Signature.writeDataStream()` bytes.
#[no_mangle]
pub extern "C" fn totem_tree_signature_serialize(
    sig_json: *const std::os::raw::c_char,
    out_len: *mut usize,
    err_out: *mut *mut std::os::raw::c_char,
) -> *mut u8 {
    let Some(s) = (unsafe { cstr(sig_json) }) else {
        if !err_out.is_null() { unsafe { *err_out = leak_cstring("null signature json".into()) }; }
        return std::ptr::null_mut();
    };
    match serde_json::from_str::<TreeSignature>(s) {
        Ok(sig) => {
            let mut out = Vec::new();
            out.extend_from_slice(&write_mini_number(sig.proofs.len() as i64, 0));
            for proof in &sig.proofs {
                out.extend_from_slice(&serialize_signature_proof(proof));
            }
            leak_bytes(out, out_len)
        }
        Err(e) => {
            if !err_out.is_null() { unsafe { *err_out = leak_cstring(format!("parse error: {e}")) }; }
            std::ptr::null_mut()
        }
    }
}

/// Read a MiniNumber at `buf[off..]` → (value, bytes_consumed).
fn read_mini_number(buf: &[u8], off: usize) -> Option<(i64, usize)> {
    if off + 2 > buf.len() {
        return None;
    }
    let len = buf[off + 1] as usize;
    if off + 2 + len > buf.len() {
        return None;
    }
    let mut value: i64 = 0;
    for i in 0..len {
        value = (value << 8) | (buf[off + 2 + i] as i64);
    }
    Some((value, 2 + len))
}

/// Deserialize Java `Signature.readDataStream()` bytes → TreeSignature JSON.
#[no_mangle]
pub extern "C" fn totem_tree_signature_deserialize(
    bytes: *const u8,
    len: usize,
    out_len: *mut usize,
    err_out: *mut *mut std::os::raw::c_char,
) -> *mut u8 {
    let buf = unsafe { as_slice(bytes, len) };
    let fail = |err_out: *mut *mut std::os::raw::c_char, msg: String| -> *mut u8 {
        if !err_out.is_null() {
            unsafe { *err_out = leak_cstring(msg) };
        }
        std::ptr::null_mut()
    };
    let Some((num_proofs, mut off)) = read_mini_number(buf, 0) else {
        return fail(err_out, "truncated proof count".into());
    };
    if num_proofs < 1 || num_proofs > 8 {
        return fail(err_out, format!("impossible proof count ({num_proofs})"));
    }
    let mut proofs = Vec::new();
    for _ in 0..num_proofs {
        // leafPubkey: MiniData (4-byte length + bytes)
        if off + 4 > buf.len() {
            return fail(err_out, "truncated leaf pubkey length".into());
        }
        let pk_len = u32::from_be_bytes([buf[off], buf[off + 1], buf[off + 2], buf[off + 3]]) as usize;
        off += 4;
        if off + pk_len > buf.len() {
            return fail(err_out, "leaf pubkey out of bounds".into());
        }
        let leaf_pubkey = buf[off..off + pk_len].to_vec();
        off += pk_len;
        // signature: MiniData
        if off + 4 > buf.len() {
            return fail(err_out, "truncated signature length".into());
        }
        let sig_len = u32::from_be_bytes([buf[off], buf[off + 1], buf[off + 2], buf[off + 3]]) as usize;
        off += 4;
        if off + sig_len > buf.len() {
            return fail(err_out, "signature out of bounds".into());
        }
        let signature = buf[off..off + sig_len].to_vec();
        off += sig_len;
        // MMRProof: blockTime MiniNumber, chunk-count MiniNumber, then chunks.
        let Some((_block_time, bt_len)) = read_mini_number(buf, off) else {
            return fail(err_out, "truncated blockTime".into());
        };
        off += bt_len;
        let Some((num_chunks, nc_len)) = read_mini_number(buf, off) else {
            return fail(err_out, "truncated chunk count".into());
        };
        off += nc_len;
        let mut chunks = Vec::new();
        for _ in 0..num_chunks {
            if off + 1 > buf.len() {
                return fail(err_out, "truncated isLeft".into());
            }
            let is_left = buf[off] == 1;
            off += 1;
            if off + 4 > buf.len() {
                return fail(err_out, "truncated mmr hash length".into());
            }
            let h_len = u32::from_be_bytes([buf[off], buf[off + 1], buf[off + 2], buf[off + 3]]) as usize;
            off += 4;
            if off + h_len > buf.len() {
                return fail(err_out, "mmr hash out of bounds".into());
            }
            let data = buf[off..off + h_len].to_vec();
            off += h_len;
            let Some((value, v_len)) = read_mini_number(buf, off) else {
                return fail(err_out, "truncated mmr value".into());
            };
            off += v_len;
            chunks.push(crate::mmr::MMRProofChunk {
                is_left,
                mmr_data: crate::mmr::MMRData { data, value: value as u64 },
            });
        }
        proofs.push(treekey::SignatureProof {
            leaf_pubkey,
            signature,
            mmr_proof: crate::mmr::MMRProof { chunks },
        });
    }
    match serde_json::to_vec(&TreeSignature { proofs }) {
        Ok(bytes) => leak_bytes(bytes, out_len),
        Err(e) => fail(err_out, format!("serialize error: {e}")),
    }
}

/// Verify a TreeSignature (JSON) against a root pubkey + 32-byte message digest.
#[no_mangle]
pub extern "C" fn totem_verify_tree_signature_json(
    root_pk: *const u8,
    root_pk_len: usize,
    message: *const u8,
    message_len: usize,
    sig_json: *const std::os::raw::c_char,
) -> i32 {
    let root_pk = unsafe { as_slice(root_pk, root_pk_len) };
    let message = unsafe { as_slice(message, message_len) };
    let Some(s) = (unsafe { cstr(sig_json) }) else { return 0; };
    let Ok(sig) = serde_json::from_str::<TreeSignature>(s) else { return 0; };
    match catch_unwind(AssertUnwindSafe(|| treekey::verify_tree_signature(root_pk, message, &sig))) {
        Ok(true) => 1,
        _ => 0,
    }
}

fn sha3(data: &[u8]) -> Vec<u8> {
    use sha3::{Digest, Sha3_256};
    let mut h = Sha3_256::new();
    h.update(data);
    h.finalize().to_vec()
}

/// Minimal big-endian bytes of an index; 0 → [0x00] (TS `indexToMiniDataBytes`).
fn index_to_mini_data_bytes(index: u32) -> Vec<u8> {
    if index == 0 {
        return vec![0x00];
    }
    let mut b = Vec::new();
    let mut n = index;
    while n > 0 {
        b.insert(0, (n & 0xff) as u8);
        n >>= 8;
    }
    b
}

/// TS `deriveRootPrivSeed` (javaStreamables): SHA3(MiniData(baseSeed) ‖ MiniData("ROOT_IDENTITY")).
///
/// NOTE: this deliberately differs from `java_streamables::derive_root_priv_seed`
/// (which omits "ROOT_IDENTITY"). The TypeScript SE/root-identity uses *this*
/// derivation, so Go must match it for cross-language parity.
pub fn derive_root_priv_seed_ts(base_seed: &[u8]) -> Vec<u8> {
    let mut buf = write_mini_data(base_seed);
    buf.extend_from_slice(&write_mini_data(b"ROOT_IDENTITY"));
    sha3(&buf)
}

/// TS `deriveUnifiedChildSeed`: SHA3(MiniData(rootPrivSeed) ‖ MiniData(indexBytes)).
pub fn derive_unified_child_seed_ts(base_seed: &[u8], index: u32) -> Vec<u8> {
    let root_priv = derive_root_priv_seed_ts(base_seed);
    let mut buf = write_mini_data(&root_priv);
    buf.extend_from_slice(&write_mini_data(&index_to_mini_data_bytes(index)));
    sha3(&buf)
}

/// Derive the root identity private seed (TS-compatible).
#[no_mangle]
pub extern "C" fn totem_derive_root_priv_seed(seed: *const u8, seed_len: usize, out_len: *mut usize) -> *mut u8 {
    let seed = unsafe { as_slice(seed, seed_len) };
    leak_bytes(derive_root_priv_seed_ts(seed), out_len)
}

/// Derive a unified child seed (TS-compatible) for an address index.
#[no_mangle]
pub extern "C" fn totem_derive_unified_child_seed(
    base_seed: *const u8,
    base_seed_len: usize,
    index: u32,
    out_len: *mut usize,
) -> *mut u8 {
    let base_seed = unsafe { as_slice(base_seed, base_seed_len) };
    leak_bytes(derive_unified_child_seed_ts(base_seed, index), out_len)
}

/// Create the unified **root** identity TreeKey (TS `createUnifiedRootTreeKey`).
#[no_mangle]
pub extern "C" fn totem_create_unified_root_tree_key(
    base_seed: *const u8,
    base_seed_len: usize,
    err_out: *mut *mut std::os::raw::c_char,
) -> u32 {
    let base_seed = unsafe { as_slice(base_seed, base_seed_len) };
    match treekey::TreeKey::new(&derive_root_priv_seed_ts(base_seed), 64, 3) {
        Ok(tk) => {
            let handle = NEXT_HANDLE.fetch_add(1, Ordering::SeqCst);
            HANDLES.lock().unwrap().insert(handle, tk);
            handle
        }
        Err(e) => {
            if !err_out.is_null() { unsafe { *err_out = leak_cstring(e) }; }
            0
        }
    }
}

/// Create a unified **child** TreeKey (TS `createUnifiedChildTreeKey`).
#[no_mangle]
pub extern "C" fn totem_create_unified_child_tree_key(
    base_seed: *const u8,
    base_seed_len: usize,
    index: u32,
    err_out: *mut *mut std::os::raw::c_char,
) -> u32 {
    let base_seed = unsafe { as_slice(base_seed, base_seed_len) };
    match treekey::TreeKey::new(&derive_unified_child_seed_ts(base_seed, index), 64, 3) {
        Ok(tk) => {
            let handle = NEXT_HANDLE.fetch_add(1, Ordering::SeqCst);
            HANDLES.lock().unwrap().insert(handle, tk);
            handle
        }
        Err(e) => {
            if !err_out.is_null() { unsafe { *err_out = leak_cstring(e) }; }
            0
        }
    }
}

/// Derive the per-address seed (`derivePerAddressSeed`) for a root seed.
#[no_mangle]
pub extern "C" fn totem_derive_per_address_seed(
    root_seed: *const u8,
    root_seed_len: usize,
    address_index: u32,
    out_len: *mut usize,
) -> *mut u8 {
    let root_seed = unsafe { as_slice(root_seed, root_seed_len) };
    leak_bytes(crate::java_streamables::derive_per_address_seed(root_seed, address_index), out_len)
}

/// Derive a Minima Mx address from a 32-byte WOTS public-key digest
/// (script `RETURN SIGNEDBY(0x..)` → MMR root → address), matching TS
/// `scriptFromWotsPk` → `scriptToAddress`.
#[no_mangle]
pub extern "C" fn totem_address_from_pk_digest(
    pk_digest: *const u8,
    pk_digest_len: usize,
    out_len: *mut usize,
) -> *mut u8 {
    let pk_digest = unsafe { as_slice(pk_digest, pk_digest_len) };
    match catch_unwind(AssertUnwindSafe(|| {
        let script = crate::script::script_from_wots_pk(pk_digest);
        let root = crate::derive::script_to_address(&script);
        crate::minima32::make_mx_address(&root)
    })) {
        Ok(Ok(addr)) => leak_bytes(addr.into_bytes(), out_len),
        _ => std::ptr::null_mut(),
    }
}

/// Derive a Minima Mx address directly from a full 1088-byte WOTS public key
/// (hashes to the 32-byte digest first), matching TS `addressFromPublicKeyBytes`.
#[no_mangle]
pub extern "C" fn totem_address_from_full_public_key(
    pk_full: *const u8,
    pk_full_len: usize,
    out_len: *mut usize,
) -> *mut u8 {
    let pk_full = unsafe { as_slice(pk_full, pk_full_len) };
    let digest = sha3(pk_full);
    match catch_unwind(AssertUnwindSafe(|| {
        let script = crate::script::script_from_wots_pk(&digest);
        let root = crate::derive::script_to_address(&script);
        crate::minima32::make_mx_address(&root)
    })) {
        Ok(Ok(addr)) => leak_bytes(addr.into_bytes(), out_len),
        _ => std::ptr::null_mut(),
    }
}

/// Serialize any byte buffer as a MiniData (4-byte length + bytes), for tests.
#[no_mangle]
pub extern "C" fn totem_write_mini_data(data: *const u8, len: usize, out_len: *mut usize) -> *mut u8 {
    let data = unsafe { as_slice(data, len) };
    leak_bytes(utils::concat_bytes(&[&write_mini_data(data)]), out_len)
}
