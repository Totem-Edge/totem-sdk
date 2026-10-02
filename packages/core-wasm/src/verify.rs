//! High-level verification API.
//!
//! Provides signature verification, tree signature verification,
//! address derivation from public keys, and Sign-In With Wallet (SIWE)
//! challenge/response.

use serde::{Deserialize, Serialize};
use sha3::{Digest, Sha3_256};

/// Constant-time comparison of two byte arrays.
///
/// Uses XOR reduction to prevent timing side-channel attacks.
/// Returns true if the arrays are equal, false otherwise.
pub fn timing_safe_equal(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for i in 0..a.len() {
        diff |= a[i] ^ b[i];
    }
    diff == 0
}

/// Verify a WOTS signature against an address and message.
///
/// This is the high-level verification function that:
/// 1. Derives the address from the public key
/// 2. Verifies the signature against the full public key
/// 3. Returns true if both match
pub fn verify_signature(
    address: &str,
    message: &[u8],
    signature: &[u8],
    public_key: &[u8],
) -> Result<bool, String> {
    // Verify the signature against the full public key
    if !crate::wots::wots_verify(signature, message, public_key) {
        return Ok(false);
    }

    // Derive the expected address from the public key
    let pk_digest = {
        let mut hasher = Sha3_256::new();
        hasher.update(public_key);
        hasher.finalize().to_vec()
    };

    let script = crate::script::script_from_wots_pk(&pk_digest);
    let address_root = crate::derive::script_to_address(&script);
    let expected_address = crate::minima32::make_mx_address(&address_root)?;

    Ok(address == expected_address)
}

/// Accept either a hex string ("0x…" or bare) or a JSON array of bytes.
///
/// The WASM sign/tree path serialises byte fields as arrays; the verify path
/// historically expected hex strings. Accept both so the sign output is directly
/// verifiable (RFC-031 P2).
fn de_bytes<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::{self, Visitor};
    struct BytesVisitor;
    impl<'de> Visitor<'de> for BytesVisitor {
        type Value = Vec<u8>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("a hex string or an array of bytes")
        }
        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            hex::decode(v.trim_start_matches("0x")).map_err(E::custom)
        }
        fn visit_string<E: de::Error>(self, v: String) -> Result<Self::Value, E> {
            self.visit_str(&v)
        }
        fn visit_seq<A: de::SeqAccess<'de>>(self, mut seq: A) -> Result<Self::Value, A::Error> {
            let mut out = Vec::new();
            while let Some(b) = seq.next_element::<u8>()? {
                out.push(b);
            }
            Ok(out)
        }
    }
    deserializer.deserialize_any(BytesVisitor)
}

/// Verify a tree signature (JSON produced by the WASM/JS TreeKey signer).
///
/// Delegates to the canonical `treekey::verify_tree_signature` over the
/// deserialized `TreeSignature`, so the sign and verify paths share one
/// implementation (RFC-031 P2).
pub fn verify_tree_signature(
    root_public_key: &[u8],
    message: &[u8],
    signature_json: &str,
) -> Result<bool, String> {
    let signature: crate::treekey::TreeSignature = serde_json::from_str(signature_json)
        .map_err(|e| format!("Invalid signature JSON: {}", e))?;

    if signature.proofs.is_empty() {
        return Err("No proofs in signature".to_string());
    }

    Ok(crate::treekey::verify_tree_signature(root_public_key, message, &signature))
}

/// Verify an MMR proof from JSON.
pub fn verify_mmr_proof_from_json(
    leaf_pubkey: &[u8],
    proof_json: &str,
    expected_root: &[u8],
) -> Result<bool, String> {
    #[derive(Deserialize)]
    struct MmrProofData {
        chunks: Vec<MmrChunkData>,
    }

    #[derive(Deserialize)]
    struct MmrChunkData {
        #[serde(rename = "isLeft", default)]
        is_left: bool,
        #[serde(rename = "mmrData")]
        mmr_data: MmrEntryData,
    }

    #[derive(Deserialize)]
    struct MmrEntryData {
        #[serde(deserialize_with = "de_bytes")]
        data: Vec<u8>,
        #[serde(default)]
        value: serde_json::Value,
    }

    let proof_data: MmrProofData =
        serde_json::from_str(proof_json).map_err(|e| format!("Invalid proof JSON: {}", e))?;

    let chunks: Vec<crate::mmr::MMRProofChunk> = proof_data
        .chunks
        .iter()
        .map(|c| {
            let data = c.mmr_data.data.clone();
            let value = match &c.mmr_data.value {
                serde_json::Value::Number(n) => n.as_u64().unwrap_or(0),
                serde_json::Value::String(s) => s.parse::<u64>().unwrap_or(0),
                _ => 0,
            };
            crate::mmr::MMRProofChunk {
                is_left: c.is_left,
                mmr_data: crate::mmr::MMRData { data, value },
            }
        })
        .collect();

    let proof = crate::mmr::MMRProof { chunks };
    Ok(crate::mmr::verify_mmr_proof(
        leaf_pubkey,
        &proof,
        expected_root,
    ))
}

/// Derive a Minima Mx address from a WOTS public key.
pub fn derive_address_from_public_key(public_key: &[u8]) -> Result<String, String> {
    let pk_digest = {
        let mut hasher = Sha3_256::new();
        hasher.update(public_key);
        hasher.finalize().to_vec()
    };
    let script = crate::script::script_from_wots_pk(&pk_digest);
    let address_root = crate::derive::script_to_address(&script);
    crate::minima32::make_mx_address(&address_root)
}

/// SIWE challenge structure.
#[derive(Serialize, Deserialize)]
pub struct Challenge {
    pub domain: String,
    pub statement: String,
    pub nonce: String,
    #[serde(rename = "issuedAt")]
    pub issued_at: u64,
    pub expiry: u64,
}

/// Create a Sign-In With Wallet challenge.
///
/// Generates a time-limited challenge with a random nonce for replay protection.
/// `now_secs` is passed from the caller because `SystemTime` panics on
/// `wasm32-unknown-unknown`.
pub fn create_challenge(domain: &str, statement: &str, now_secs: u64) -> Result<String, String> {
    let mut nonce_bytes = [0u8; 16];
    getrandom::getrandom(&mut nonce_bytes)
        .map_err(|e| format!("Failed to generate nonce: {}", e))?;

    let nonce = hex::encode(nonce_bytes);
    let now = now_secs;

    let challenge = Challenge {
        domain: domain.to_string(),
        statement: statement.to_string(),
        nonce,
        issued_at: now,
        expiry: now + 300, // 5 minutes
    };

    serde_json::to_string(&challenge).map_err(|e| format!("Failed to serialize challenge: {}", e))
}

/// Validate a Sign-In With Wallet challenge.
///
/// Checks:
/// - Challenge is valid JSON
/// - Domain matches
/// - Nonce is at least 8 characters
/// - Challenge has not expired
///
/// `now_secs` is passed from the caller because `SystemTime` panics on
/// `wasm32-unknown-unknown`.
pub fn validate_challenge(challenge_json: &str, domain: &str, now_secs: u64) -> Result<bool, String> {
    let challenge: Challenge = serde_json::from_str(challenge_json)
        .map_err(|e| format!("Invalid challenge JSON: {}", e))?;

    // Domain must match
    if challenge.domain != domain {
        return Ok(false);
    }

    // Nonce must be at least 8 characters
    if challenge.nonce.len() < 8 {
        return Ok(false);
    }

    // Challenge must not be expired
    let now = now_secs;

    if now > challenge.expiry {
        return Ok(false);
    }

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timing_safe_equal_identical() {
        let a = [1u8, 2, 3, 4];
        let b = [1u8, 2, 3, 4];
        assert!(timing_safe_equal(&a, &b));
    }

    #[test]
    fn test_timing_safe_equal_different() {
        let a = [1u8, 2, 3, 4];
        let b = [1u8, 2, 3, 5];
        assert!(!timing_safe_equal(&a, &b));
    }

    #[test]
    fn test_timing_safe_equal_different_length() {
        assert!(!timing_safe_equal(&[1, 2], &[1, 2, 3]));
    }

    #[test]
    fn test_create_and_validate_challenge() {
        let challenge_json = create_challenge("test.totem.ing", "Sign in to TestApp", 1_700_000_000).unwrap();
        assert!(validate_challenge(&challenge_json, "test.totem.ing", 1_700_000_001).unwrap());
    }

    #[test]
    fn test_validate_challenge_wrong_domain() {
        let challenge_json = create_challenge("test.totem.ing", "Sign in", 1_700_000_000).unwrap();
        assert!(!validate_challenge(&challenge_json, "evil.example.com", 1_700_000_001).unwrap());
    }

    #[test]
    fn test_validate_challenge_invalid_json() {
        assert!(validate_challenge("not json", "test.totem.ing", 1_700_000_000).is_err());
    }

    #[test]
    fn test_derive_address_from_public_key() {
        let seed = [42u8; 32];
        let pk = crate::wots::derive_full_public_key(&seed, 0);
        let address = derive_address_from_public_key(&pk).unwrap();
        assert!(address.starts_with("Mx"));
    }
}
