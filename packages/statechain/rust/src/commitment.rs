use sha3::{Digest, Sha3_256};

pub fn compute_transfer_commitment(
    chain_id: &str,
    from: &str,
    to: &str,
    sequence: u32,
    timestamp: u64,
) -> Vec<u8> {
    let canonical = serde_json::json!({
        "chainId": chain_id,
        "from": from,
        "to": to,
        "sequence": sequence,
        "timestamp": timestamp,
    });
    let input = serde_json::to_string(&canonical).unwrap_or_default();
    let mut hasher = Sha3_256::new();
    hasher.update(input.as_bytes());
    hasher.finalize().to_vec()
}

pub fn compute_reclaim_commitment(
    coin_id: &str,
    owner_pkd: &str,
    locking_address: &str,
) -> Vec<u8> {
    let data = serde_json::json!({
        "type": "reclaim",
        "coinId": coin_id,
        "ownerPkd": owner_pkd,
        "lockingAddress": locking_address,
    });
    let input = serde_json::to_string(&data).unwrap_or_default();
    let mut hasher = Sha3_256::new();
    hasher.update(input.as_bytes());
    hasher.finalize().to_vec()
}
