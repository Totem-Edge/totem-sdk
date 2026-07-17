/// WOTS+ implementation — BouncyCastle-compatible
///
/// Matches org.bouncycastle.pqc.crypto.gmss.util.WinternitzOTSignature
/// and WinternitzOTSVerify byte-for-byte.
///
/// Key parameters (w=8, n=256, L=34):
/// - w=8 means 8 bits per digit, each byte is one digit (0-255)
/// - Stateful PRNG (GMSSRandom) for chain seed derivation
/// - 34 total chains (32 message + 2 checksum)
/// - Each chain hashed up to 255 times (2^8 - 1)

use sha3::{Digest, Sha3_256};
use crate::params::*;
use crate::java_streamables::derive_chain_seed_java;

/// SHA3-256 hash function.
fn sha3_256(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha3_256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

/// GMSSRandom — BouncyCastle's stateful PRNG for WOTS chain seed derivation.
///
/// Algorithm from GMSSRandom.java:
///   rand = H(state)
///   state = state + rand + 1 (byte-wise addition with carry, little-endian)
///   return rand
///
/// The state is MUTATED in place after each call.
pub struct GMSSRandom;

impl GMSSRandom {
    /// Generate next random value and update state.
    /// state: 32-byte mutable state array (MUTATED in place)
    /// returns: 32-byte random value
    pub fn next_seed(state: &mut [u8]) -> Vec<u8> {
        assert_eq!(state.len(), 32, "state must be exactly 32 bytes");

        // rand = H(state)
        let rand = sha3_256(state);

        // state = state + rand (byte-wise addition with carry, little-endian)
        Self::add_byte_arrays(state, &rand);

        // state = state + 1
        Self::add_one(state);

        rand
    }

    /// Add two byte arrays: a = a + b (little-endian, with carry).
    /// Matches GMSSRandom.addByteArrays()
    fn add_byte_arrays(a: &mut [u8], b: &[u8]) {
        let mut overflow: u16 = 0;
        for (a_byte, b_byte) in a.iter_mut().zip(b.iter()) {
            let temp = (*a_byte as u16) + (*b_byte as u16) + overflow;
            *a_byte = temp as u8;
            overflow = temp >> 8;
        }
    }

    /// Add one to byte array: a = a + 1 (little-endian, with carry).
    /// Matches GMSSRandom.addOne()
    fn add_one(a: &mut [u8]) {
        let mut overflow: u16 = 1;
        for a_byte in a.iter_mut() {
            let temp = (*a_byte as u16) + overflow;
            *a_byte = temp as u8;
            overflow = temp >> 8;
            if overflow == 0 {
                break;
            }
        }
    }
}

/// Expand master seed into L private key chains using GMSSRandom.
///
/// Matches WinternitzOTSignature constructor:
///   byte[] dummy = new byte[mdsize];
///   System.arraycopy(seed0, 0, dummy, 0, dummy.length);
///   for (int i = 0; i < keysize; i++) {
///     privateKeyOTS[i] = gmssRandom.nextSeed(dummy);
///   }
pub fn expand_private_key(seed: &[u8]) -> Vec<Vec<u8>> {
    assert_eq!(seed.len(), 32, "seed must be exactly 32 bytes");

    // Copy seed to mutable state
    let mut state = seed.to_vec();

    // Generate L chain seeds using stateful PRNG
    let mut private_keys = Vec::with_capacity(WOTS_L);
    for _ in 0..WOTS_L {
        let pk = GMSSRandom::next_seed(&mut state);
        private_keys.push(pk);
    }

    private_keys
}

/// Convert message hash to Winternitz digits with checksum.
///
/// For w=8 (8 bits per digit), since 8 % 8 == 0:
/// - Each byte of the hash IS one digit (0-255)
/// - messagesize = 32 digits
/// - checksum = (messagesize << w) - sum = 8192 - sum
/// - checksumsize = 14 bits, extracted as 2 digits
pub fn to_winternitz_digits(hash32: &[u8]) -> (Vec<u16>, Vec<u16>) {
    assert_eq!(hash32.len(), 32, "hash must be exactly 32 bytes");

    // For w=8: each byte IS a digit (0-255)
    let mut digits = Vec::with_capacity(32);
    let mut c: u32 = 0; // checksum accumulator

    for &byte in hash32.iter() {
        let digit = byte as u16;
        digits.push(digit);
        c += digit as u32;
    }

    // Checksum = (messagesize << w) - c = (32 << 8) - c = 8192 - c
    let mut checksum = (32u32 << 8) - c;

    // Extract checksum digits: 2 digits, each 0-255
    // checksumsize = 14 bits, iterate by w=8 bits
    let mut checksum_digits = Vec::with_capacity(2);
    let k = MAX_DIGIT as u32; // 255
    for _ in (0..14).step_by(8) {
        checksum_digits.push((checksum & k) as u16);
        checksum >>= 8;
    }

    (digits, checksum_digits)
}

/// Decompose digest into base-w digits + checksum.
/// Returns flat array of all L digits.
pub fn base_w_with_checksum(msg_hash: &[u8]) -> Vec<u16> {
    let (digits, checksum_digits) = to_winternitz_digits(msg_hash);
    let mut result = digits;
    result.extend(checksum_digits);
    assert_eq!(result.len(), WOTS_L, "Invalid digit length");
    result
}

/// Hash a value k times.
///
/// Matches WinternitzOTSignature.hashPrivateKeyBlock():
/// - If rounds < 1: return input unchanged
/// - Otherwise: hash `rounds` times
pub fn hash_chain(x: &[u8], rounds: u16) -> Vec<u8> {
    if rounds < 1 {
        return x.to_vec();
    }
    let mut result = sha3_256(x);
    for _ in 1..rounds {
        result = sha3_256(&result);
    }
    result
}

/// Derive WOTS public key digest from seed and key index.
///
/// Matches WinternitzOTSignature.getPublicKey():
///   int rounds = (1 << w) - 1;  // 255 for w=8
///   for (int i = 0; i < keysize; i++) {
///     hashPrivateKeyBlock(i, rounds, buf, pos);
///   }
///   return H(buf);
pub fn derive_pk_digest(seed: &[u8], key_index: u32) -> Vec<u8> {
    assert_eq!(seed.len(), 32, "seed must be exactly 32 bytes");

    // Derive unique seed for this key index
    let indexed_seed = derive_chain_seed_java(seed, key_index);

    // Expand indexed seed into private keys
    let private_keys = expand_private_key(&indexed_seed);

    // Hash each chain 255 times to get chain tops
    let rounds = MAX_DIGIT; // 255
    let mut buf = Vec::with_capacity(WOTS_L * 32);

    for private_key in private_keys.iter().take(WOTS_L) {
        let top = hash_chain(private_key, rounds);
        buf.extend_from_slice(&top);
    }

    // Return H(all chain tops)
    sha3_256(&buf)
}

/// Derive full WOTS public key (L × 32 bytes) without final hash.
///
/// Returns the concatenation of all chain tops BEFORE hashing.
/// Required by Minima's SignatureProof which expects the full public key.
pub fn derive_full_public_key(seed: &[u8], key_index: u32) -> Vec<u8> {
    assert_eq!(seed.len(), 32, "seed must be exactly 32 bytes");

    let indexed_seed = derive_chain_seed_java(seed, key_index);
    let private_keys = expand_private_key(&indexed_seed);
    let rounds = MAX_DIGIT; // 255
    let mut buf = Vec::with_capacity(WOTS_L * 32);

    for private_key in private_keys.iter().take(WOTS_L) {
        let top = hash_chain(private_key, rounds);
        buf.extend_from_slice(&top);
    }

    buf // L * 32 = 1088 bytes
}

/// Sign a message using WOTS.
///
/// Matches Java's WinternitzOTSignature.getSignature():
/// 1. Hash the message internally: hashedMsg = SHA3-256(message)
/// 2. For each digit d[i]: sig[i] = hash(privateKey[i], d[i] times)
///
/// IMPORTANT: This function hashes the message internally to match Java/BouncyCastle.
/// Callers pass RAW 32-byte data (tx digest, child root), NOT pre-hashed!
///
/// Returns flat signature (L × 32 = 1088 bytes).
pub fn wots_sign(seed: &[u8], key_index: u32, message: &[u8]) -> Vec<u8> {
    assert_eq!(seed.len(), 32, "seed must be exactly 32 bytes");
    assert_eq!(message.len(), 32, "message must be exactly 32 bytes");

    // Derive unique seed for this key index
    let indexed_seed = derive_chain_seed_java(seed, key_index);
    let private_keys = expand_private_key(&indexed_seed);

    // CRITICAL: Hash the message internally to match Java/BouncyCastle
    let hashed_msg = sha3_256(message);
    let (digits, checksum_digits) = to_winternitz_digits(&hashed_msg);
    let mut all_digits = digits;
    all_digits.extend(checksum_digits);

    assert_eq!(all_digits.len(), WOTS_L, "Digit length mismatch");

    let mut out = Vec::with_capacity(WOTS_L * 32);

    for j in 0..WOTS_L {
        let rounds = all_digits[j];
        let sig_part = hash_chain(&private_keys[j], rounds);
        out.extend_from_slice(&sig_part);
    }

    out
}

/// Recover full public key from signature.
///
/// Matches WinternitzOTSVerify.Verify():
///   1. Hash the message: hashedMsg = SHA3-256(message)
///   2. for each digit d[i]:
///      top[i] = hash(sig[i], (255 - d[i]) times)
///   3. return H(concat(tops))
pub fn wots_pk_from_sig(message: &[u8], signature: &[u8]) -> Vec<u8> {
    let expected_len = WOTS_L * 32;
    assert_eq!(signature.len(), expected_len, "signature must be {} bytes", expected_len);

    // CRITICAL: Hash the message internally to match Java/BouncyCastle
    let hashed_msg = sha3_256(message);
    let all_digits = base_w_with_checksum(&hashed_msg);

    let mut buf = Vec::with_capacity(expected_len);

    for i in 0..WOTS_L {
        let sig_part = &signature[i * 32..(i + 1) * 32];
        let steps_up = MAX_DIGIT - all_digits[i]; // 255 - d[i]
        let top = hash_chain(sig_part, steps_up);
        buf.extend_from_slice(&top);
    }

    sha3_256(&buf)
}

/// Verify WOTS signature against a FULL 1088-byte public key.
///
/// Matches Java's Winternitz.verify():
/// 1. Hash the message internally: hashedMsg = SHA3-256(message)
/// 2. Recover FULL public key from signature using hashedMsg (1088 bytes)
/// 3. Compare FULL reconstructed key to expected FULL public key
///
/// CRITICAL: Java's Winternitz.verify() compares the FULL 1088-byte reconstructed
/// public key against the FULL 1088-byte stored public key, NOT a 32-byte digest!
pub fn wots_verify(sig: &[u8], message: &[u8], pk_full: &[u8]) -> bool {
    let expected_len = WOTS_L * 32;
    if pk_full.len() != expected_len || sig.len() != expected_len {
        return false;
    }

    // CRITICAL: Hash the message internally to match Java/BouncyCastle
    let hashed_msg = sha3_256(message);
    let all_digits = base_w_with_checksum(&hashed_msg);
    let mut buf = vec![0u8; expected_len];

    for j in 0..WOTS_L {
        let sig_part = &sig[j * 32..(j + 1) * 32];
        let steps_up = MAX_DIGIT - all_digits[j];
        let top = hash_chain(sig_part, steps_up);
        buf[j * 32..(j + 1) * 32].copy_from_slice(&top);
    }

    // Constant-time comparison of FULL 1088-byte keys
    // This matches Java: resp.isEqual(zPublicKey) where both are 1088 bytes
    let mut diff: u8 = 0;
    for i in 0..expected_len {
        diff |= buf[i] ^ pk_full[i];
    }
    diff == 0
}

/// Verify WOTS signature against a 32-byte public key digest.
/// Legacy function — prefer wots_verify with full 1088-byte public key.
pub fn wots_verify_digest(sig: &[u8], message: &[u8], pk_digest: &[u8]) -> bool {
    let expected_len = WOTS_L * 32;
    if sig.len() != expected_len || pk_digest.len() != 32 {
        return false;
    }

    let hashed_msg = sha3_256(message);
    let all_digits = base_w_with_checksum(&hashed_msg);
    let mut buf = vec![0u8; expected_len];

    for j in 0..WOTS_L {
        let sig_part = &sig[j * 32..(j + 1) * 32];
        let steps_up = MAX_DIGIT - all_digits[j];
        let top = hash_chain(sig_part, steps_up);
        buf[j * 32..(j + 1) * 32].copy_from_slice(&top);
    }

    let recomputed = sha3_256(&buf);

    // Constant-time comparison
    let mut diff: u8 = 0;
    for i in 0..32 {
        diff |= recomputed[i] ^ pk_digest[i];
    }
    diff == 0
}

/// Generate WOTS public key digest from seed (convenience wrapper).
pub fn wots_public_key_from_seed(seed: &[u8], key_index: u32) -> Vec<u8> {
    derive_pk_digest(seed, key_index)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gmss_random_deterministic() {
        let mut state = [0u8; 32];
        let r1 = GMSSRandom::next_seed(&mut state);
        let r2 = GMSSRandom::next_seed(&mut state);
        assert_eq!(r1.len(), 32);
        assert_eq!(r2.len(), 32);
        assert_ne!(r1, r2);
    }

    #[test]
    fn test_expand_private_key_length() {
        let seed = [1u8; 32];
        let keys = expand_private_key(&seed);
        assert_eq!(keys.len(), WOTS_L);
        for key in &keys {
            assert_eq!(key.len(), 32);
        }
    }

    #[test]
    fn test_hash_chain_zero_rounds() {
        let x = [1u8; 32];
        let result = hash_chain(&x, 0);
        assert_eq!(result, x.to_vec());
    }

    #[test]
    fn test_hash_chain_one_round() {
        let x = [1u8; 32];
        let result = hash_chain(&x, 1);
        assert_eq!(result, sha3_256(&x));
    }

    #[test]
    fn test_sign_verify_roundtrip() {
        let seed = [42u8; 32];
        let message = [99u8; 32];
        let pk_full = derive_full_public_key(&seed, 0);
        let sig = wots_sign(&seed, 0, &message);
        assert!(wots_verify(&sig, &message, &pk_full));
    }

    #[test]
    fn test_sign_verify_wrong_message_fails() {
        let seed = [42u8; 32];
        let message = [99u8; 32];
        let wrong_message = [100u8; 32];
        let pk_full = derive_full_public_key(&seed, 0);
        let sig = wots_sign(&seed, 0, &message);
        assert!(!wots_verify(&sig, &wrong_message, &pk_full));
    }

    #[test]
    fn test_sign_verify_different_key_fails() {
        let seed1 = [42u8; 32];
        let seed2 = [43u8; 32];
        let message = [99u8; 32];
        let pk_full = derive_full_public_key(&seed1, 0);
        let sig = wots_sign(&seed2, 0, &message);
        assert!(!wots_verify(&sig, &message, &pk_full));
    }

    #[test]
    fn test_pk_digest_length() {
        let seed = [42u8; 32];
        let digest = derive_pk_digest(&seed, 0);
        assert_eq!(digest.len(), 32);
    }

    #[test]
    fn test_full_pk_length() {
        let seed = [42u8; 32];
        let pk = derive_full_public_key(&seed, 0);
        assert_eq!(pk.len(), WOTS_L * 32);
        assert_eq!(pk.len(), 1088);
    }

    #[test]
    fn test_signature_length() {
        let seed = [42u8; 32];
        let message = [99u8; 32];
        let sig = wots_sign(&seed, 0, &message);
        assert_eq!(sig.len(), WOTS_L * 32);
        assert_eq!(sig.len(), 1088);
    }

    #[test]
    fn test_different_key_index_produces_different_sig() {
        let seed = [42u8; 32];
        let message = [99u8; 32];
        let sig0 = wots_sign(&seed, 0, &message);
        let sig1 = wots_sign(&seed, 1, &message);
        assert_ne!(sig0, sig1);
    }
}

// ---------------------------------------------------------------------------
// Batch APIs — sign/verify multiple messages in one call
// ---------------------------------------------------------------------------

/// Sign multiple messages with the same key index.
/// Returns flat concatenated signatures: [sig0(1088B), sig1(1088B), ...]
pub fn wots_sign_batch(seed: &[u8], key_index: u32, messages: &[Vec<u8>]) -> Vec<u8> {
    let mut result = Vec::with_capacity(messages.len() * WOTS_L * 32);
    for msg in messages {
        let sig = wots_sign(seed, key_index, msg);
        result.extend_from_slice(&sig);
    }
    result
}

/// Derive public key digests for a range of key indices.
/// Returns flat concatenated digests: [pk0(32B), pk1(32B), ...]
pub fn derive_pk_digest_batch(seed: &[u8], start_index: u32, count: u32) -> Vec<u8> {
    let mut result = Vec::with_capacity(count as usize * 32);
    for i in 0..count {
        let pk = derive_pk_digest(seed, start_index + i);
        result.extend_from_slice(&pk);
    }
    result
}

/// Derive full public keys for a range of key indices.
/// Returns flat concatenated keys: [pk0(1088B), pk1(1088B), ...]
pub fn derive_full_public_key_batch(seed: &[u8], start_index: u32, count: u32) -> Vec<u8> {
    let mut result = Vec::with_capacity(count as usize * WOTS_L * 32);
    for i in 0..count {
        let pk = derive_full_public_key(seed, start_index + i);
        result.extend_from_slice(&pk);
    }
    result
}

#[cfg(test)]
mod batch_tests {
    use super::*;

    #[test]
    fn test_wots_sign_batch() {
        let seed = [42u8; 32];
        let msgs: Vec<Vec<u8>> = (0..3).map(|i| vec![i as u8; 32]).collect();
        let batch = wots_sign_batch(&seed, 0, &msgs);
        assert_eq!(batch.len(), 3 * WOTS_L * 32);

        // Verify each signature individually
        let pk = derive_full_public_key(&seed, 0);
        for (i, msg) in msgs.iter().enumerate() {
            let sig = &batch[i * WOTS_L * 32..(i + 1) * WOTS_L * 32];
            assert!(wots_verify(sig, msg, &pk));
        }
    }

    #[test]
    fn test_derive_pk_digest_batch() {
        let seed = [42u8; 32];
        let batch = derive_pk_digest_batch(&seed, 0, 4);
        assert_eq!(batch.len(), 4 * 32);

        // Verify each digest individually
        for i in 0..4 {
            let pk = &batch[i * 32..(i + 1) * 32];
            let expected = derive_pk_digest(&seed, i as u32);
            assert_eq!(pk, expected.as_slice());
        }
    }
}
