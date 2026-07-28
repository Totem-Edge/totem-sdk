use sha3::Digest;
use sha3::Sha3_256;

use crate::types::{OwnershipProof, VerifyResult};

const OWNERSHIP_OP: &str = "TOTEM_OWNERSHIP_PROOF_V1";

fn build_ownership_message(root_address: &str, child_public_keys: &[String], timestamp: &str) -> String {
    let mut sorted = child_public_keys.to_vec();
    sorted.sort();
    serde_json::json!({
        "op": OWNERSHIP_OP,
        "rootAddress": root_address,
        "childPublicKeys": sorted,
        "timestamp": timestamp,
    })
    .to_string()
}

pub fn verify_ownership_proof(
    proof: &OwnershipProof,
    verify_sig_fn: &dyn Fn(&str, &[u8], &str) -> bool,
) -> VerifyResult {
    if proof.child_addresses.is_empty() {
        return VerifyResult { valid: false, reason: Some("no child addresses".to_string()) };
    }
    if proof.child_addresses.len() != proof.child_public_keys.len() {
        return VerifyResult { valid: false, reason: Some("child address/public key count mismatch".to_string()) };
    }

    let canonical_message = build_ownership_message(
        &proof.root_address, &proof.child_public_keys, &proof.timestamp,
    );

    if proof.root_proof.message != canonical_message {
        return VerifyResult { valid: false, reason: Some("canonical message mismatch".to_string()) };
    }

    let message_bytes = canonical_message.as_bytes();
    let mut hasher = sha3::Sha3_256::new();
    hasher.update(message_bytes);
    let digest = hasher.finalize();

    if !verify_sig_fn(&proof.root_proof.signature, &digest, &proof.root_public_key) {
        return VerifyResult { valid: false, reason: Some("root WOTS signature invalid".to_string()) };
    }

    VerifyResult { valid: true, reason: None }
}
