use sha3::{Digest, Sha3_256};

use crate::canonical::{canonical_json, to_hex};
use crate::types::SignedProof;

pub fn create_anchor_commitment(signed_proof: &SignedProof) -> String {
    let subject_json = serde_json::to_value(&signed_proof.subject).unwrap_or_default();
    let input = format!(
        "totem-anchor{}{}",
        signed_proof.proof_id,
        canonical_json(&subject_json)
    );
    let mut hasher = Sha3_256::new();
    hasher.update(input.as_bytes());
    to_hex(&hasher.finalize())
}

pub fn verify_anchor_ref(signed_proof: &SignedProof, anchor_hash: &str) -> bool {
    let expected = create_anchor_commitment(signed_proof);
    expected == anchor_hash
}
