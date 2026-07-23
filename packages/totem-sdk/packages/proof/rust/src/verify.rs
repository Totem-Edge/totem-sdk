use sha3::{Digest, Sha3_256};

use crate::canonical::{canonical_json, compute_proof_id};
use crate::types::{ProofVerifyResult, SignedProof};

pub fn verify_proof_id_integrity(signed_proof: &SignedProof) -> bool {
    let unsigned = serde_json::json!({
        "kind": signed_proof.kind,
        "subject": signed_proof.subject,
        "issuer": signed_proof.issuer,
        "issuedAt": signed_proof.issued_at,
        "expiresAt": signed_proof.expires_at,
        "evidence": signed_proof.evidence,
        "links": signed_proof.links,
        "payload": signed_proof.payload,
    });
    let expected_id = compute_proof_id(&unsigned);
    expected_id == signed_proof.proof_id
}

pub fn verify_proof_payload(signed_proof: &SignedProof, grace_ms: u64, now: u64) -> bool {
    if let Some(expires_at) = signed_proof.expires_at {
        if now > expires_at + grace_ms {
            return false;
        }
    }
    true
}

pub fn verify_proof(
    signed_proof: &SignedProof,
    verify_sig_fn: &dyn Fn(&str, &[u8], &str) -> bool,
    grace_ms: u64,
    now: u64,
) -> ProofVerifyResult {
    if signed_proof.signature.address.is_empty()
        || signed_proof.signature.public_key.is_empty()
        || signed_proof.signature.signature.is_empty()
    {
        return ProofVerifyResult {
            valid: false,
            expired: None,
            reason: Some("signature missing required fields (address, publicKey, signature)".to_string()),
            signer_address: Some(signed_proof.signature.address.clone()),
        };
    }

    if !verify_proof_id_integrity(signed_proof) {
        return ProofVerifyResult {
            valid: false,
            expired: None,
            reason: Some("proofId does not match recomputed value".to_string()),
            signer_address: Some(signed_proof.signature.address.clone()),
        };
    }

    let expired = !verify_proof_payload(signed_proof, grace_ms, now);
    if expired {
        return ProofVerifyResult {
            valid: false,
            expired: Some(true),
            reason: Some("proof has expired".to_string()),
            signer_address: Some(signed_proof.signature.address.clone()),
        };
    }

    let unsigned = serde_json::json!({
        "kind": signed_proof.kind,
        "subject": signed_proof.subject,
        "issuer": signed_proof.issuer,
        "issuedAt": signed_proof.issued_at,
        "expiresAt": signed_proof.expires_at,
        "evidence": signed_proof.evidence,
        "links": signed_proof.links,
        "payload": signed_proof.payload,
    });

    let digest_input = canonical_json(&unsigned);
    let mut hasher = Sha3_256::new();
    hasher.update(digest_input.as_bytes());
    let digest = hasher.finalize();

    if !verify_sig_fn(&signed_proof.signature.signature, &digest, &signed_proof.signature.public_key) {
        return ProofVerifyResult {
            valid: false,
            expired: None,
            reason: Some("WOTS signature invalid".to_string()),
            signer_address: Some(signed_proof.signature.address.clone()),
        };
    }

    ProofVerifyResult {
        valid: true,
        expired: None,
        reason: None,
        signer_address: Some(signed_proof.signature.address.clone()),
    }
}
