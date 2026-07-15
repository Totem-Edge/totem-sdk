/// High-level verification API.
///
/// Provides signature verification, tree signature verification,
/// address derivation from public keys, and Sign-In With Wallet (SIWE)
/// challenge/response.

use sha3::{Digest, Sha3_256};
use serde::{Deserialize, Serialize};

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

/// Verify a tree signature (3-proof chain: Root→L1→L2→DATA).
///
/// This is a simplified verification that checks the structure
/// of a hierarchical TreeKey signature.
pub fn verify_tree_signature(
    root_public_key: &[u8],
    message: &[u8],
    signature_json: &str,
) -> Result<bool, String> {
    #[derive(Deserialize)]
    struct TreeSignature {
        proofs: Vec<SignatureProofData>,
    }

    #[derive(Deserialize)]
    struct SignatureProofData {
        #[serde(rename = "leafPubkey")]
        leaf_pubkey: String,
        signature: String,
        #[serde(rename = "mmrProof")]
        mmr_proof: MmrProofData,
    }

    #[derive(Deserialize)]
    struct MmrProofData {
        chunks: Vec<MmrChunkData>,
    }

    #[derive(Deserialize)]
    struct MmrChunkData {
        #[serde(rename = "isLeft")]
        is_left: bool,
        #[serde(rename = "mmrData")]
        mmr_data: MmrEntryData,
    }

    #[derive(Deserialize)]
    struct MmrEntryData {
        data: String,
        value: String,
    }

    let sig: TreeSignature = serde_json::from_str(signature_json)
        .map_err(|e| format!("Invalid signature JSON: {}", e))?;

    if sig.proofs.is_empty() {
        return Err("No proofs in signature".to_string());
    }

    // Verify the data-level proof (last proof in chain)
    let data_proof = sig.proofs.last().unwrap();
    let leaf_pubkey = hex::decode(data_proof.leaf_pubkey.trim_start_matches("0x"))
        .map_err(|e| format!("Invalid leaf pubkey hex: {}", e))?;
    let sig_bytes = hex::decode(data_proof.signature.trim_start_matches("0x"))
        .map_err(|e| format!("Invalid signature hex: {}", e))?;

    // Verify the WOTS signature against the leaf public key
    if !crate::wots::wots_verify(&sig_bytes, message, &leaf_pubkey) {
        return Ok(false);
    }

    // Verify the chain of proofs up to the root
    let mut current_pk = leaf_pubkey;
    for proof in sig.proofs.iter().rev().skip(1) {
        let parent_pubkey = hex::decode(proof.leaf_pubkey.trim_start_matches("0x"))
            .map_err(|e| format!("Invalid parent pubkey hex: {}", e))?;
        let parent_sig = hex::decode(proof.signature.trim_start_matches("0x"))
            .map_err(|e| format!("Invalid parent signature hex: {}", e))?;

        if !crate::wots::wots_verify(&parent_sig, &current_pk, &parent_pubkey) {
            return Ok(false);
        }
        current_pk = parent_pubkey;
    }

    Ok(timing_safe_equal(&current_pk, root_public_key))
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
        #[serde(rename = "isLeft")]
        is_left: bool,
        #[serde(rename = "mmrData")]
        mmr_data: MmrEntryData,
    }

    #[derive(Deserialize)]
    struct MmrEntryData {
        data: String,
        value: String,
    }

    let proof_data: MmrProofData = serde_json::from_str(proof_json)
        .map_err(|e| format!("Invalid proof JSON: {}", e))?;

    let chunks: Vec<crate::mmr::MMRProofChunk> = proof_data.chunks.iter().map(|c| {
        let data = hex::decode(c.mmr_data.data.trim_start_matches("0x")).unwrap_or_default();
        let value = c.mmr_data.value.parse::<u64>().unwrap_or(0);
        crate::mmr::MMRProofChunk {
            is_left: c.is_left,
            mmr_data: crate::mmr::MMRData { data, value },
        }
    }).collect();

    let proof = crate::mmr::MMRProof { chunks };
    Ok(crate::mmr::verify_mmr_proof(leaf_pubkey, &proof, expected_root))
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
pub fn create_challenge(domain: &str, statement: &str) -> Result<String, String> {
    let mut nonce_bytes = [0u8; 16];
    getrandom::getrandom(&mut nonce_bytes)
        .map_err(|e| format!("Failed to generate nonce: {}", e))?;

    let nonce = hex::encode(nonce_bytes);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("System time error: {}", e))?
        .as_secs();

    let challenge = Challenge {
        domain: domain.to_string(),
        statement: statement.to_string(),
        nonce,
        issued_at: now,
        expiry: now + 300, // 5 minutes
    };

    serde_json::to_string(&challenge)
        .map_err(|e| format!("Failed to serialize challenge: {}", e))
}

/// Validate a Sign-In With Wallet challenge.
///
/// Checks:
/// - Challenge is valid JSON
/// - Domain matches
/// - Nonce is at least 8 characters
/// - Challenge has not expired
pub fn validate_challenge(challenge_json: &str, domain: &str) -> Result<bool, String> {
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
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("System time error: {}", e))?
        .as_secs();

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
        let challenge_json = create_challenge("test.totem.ing", "Sign in to TestApp").unwrap();
        assert!(validate_challenge(&challenge_json, "test.totem.ing").unwrap());
    }

    #[test]
    fn test_validate_challenge_wrong_domain() {
        let challenge_json = create_challenge("test.totem.ing", "Sign in").unwrap();
        assert!(!validate_challenge(&challenge_json, "evil.example.com").unwrap());
    }

    #[test]
    fn test_validate_challenge_invalid_json() {
        assert!(validate_challenge("not json", "test.totem.ing").is_err());
    }

    #[test]
    fn test_derive_address_from_public_key() {
        let seed = [42u8; 32];
        let pk = crate::wots::derive_full_public_key(&seed, 0);
        let address = derive_address_from_public_key(&pk).unwrap();
        assert!(address.starts_with("Mx"));
    }
}
