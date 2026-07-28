use sha3::{Digest, Sha3_256};

use crate::canonical::to_hex;

pub fn compute_identity_id(kind: &str, root_address: &str) -> String {
    let input = format!("totem-identity\0{}\0{}", kind, root_address);
    let mut hasher = Sha3_256::new();
    hasher.update(input.as_bytes());
    format!("totem:id:{}:{}", kind, to_hex(&hasher.finalize()))
}

pub fn compute_claim_id(
    claim_type: &str,
    issuer: &str,
    subject: &str,
    object: &str,
    issued_at: u64,
    payload: Option<&serde_json::Value>,
) -> String {
    let payload_str = payload
        .map(|p| serde_json::to_string(p).unwrap_or_default())
        .unwrap_or_default();
    let input = format!(
        "totem-identity-claim\0{}\0{}\0{}\0{}\0{}\0{}",
        claim_type, issuer, subject, object, issued_at, payload_str
    );
    let mut hasher = Sha3_256::new();
    hasher.update(input.as_bytes());
    to_hex(&hasher.finalize())
}
