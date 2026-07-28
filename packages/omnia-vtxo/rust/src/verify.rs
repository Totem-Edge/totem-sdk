use crate::commitment::{compute_vtxo_leaf, verify_merkle_proof};
use crate::types::{OmniaVtxo, VerifyVtxoResult};

pub fn verify_vtxo(vtxo: &OmniaVtxo) -> VerifyVtxoResult {
    if vtxo.vtxo_id.is_empty() {
        return VerifyVtxoResult { valid: false, reason: Some("missing vtxoId".to_string()) };
    }
    if vtxo.pool_id.is_empty() {
        return VerifyVtxoResult { valid: false, reason: Some("missing poolId".to_string()) };
    }
    if vtxo.owner.is_empty() {
        return VerifyVtxoResult { valid: false, reason: Some("missing owner".to_string()) };
    }
    if vtxo.amount.parse::<u128>().unwrap_or(0) == 0 {
        return VerifyVtxoResult { valid: false, reason: Some("amount must be positive".to_string()) };
    }
    VerifyVtxoResult { valid: true, reason: None }
}

pub fn verify_vtxo_proof(vtxo: &OmniaVtxo, commitment_root: &str) -> VerifyVtxoResult {
    let leaf = compute_vtxo_leaf(
        &vtxo.pool_id, &vtxo.owner, &vtxo.amount, &vtxo.token_id, &vtxo.nonce, vtxo.epoch,
    );

    match &vtxo.merkle_proof {
        Some(proof) if !proof.is_empty() => {
            let proof_bytes: Vec<Vec<u8>> = proof.iter().map(|s| hex::decode(s).unwrap_or_default()).collect();
            if verify_merkle_proof(&leaf, &proof_bytes, commitment_root, 0) {
                VerifyVtxoResult { valid: true, reason: None }
            } else {
                VerifyVtxoResult { valid: false, reason: Some("Merkle proof verification failed".to_string()) }
            }
        }
        _ => {
            if hex::encode(&leaf) == commitment_root {
                VerifyVtxoResult { valid: true, reason: None }
            } else {
                VerifyVtxoResult { valid: false, reason: Some("leaf hash does not match commitment root".to_string()) }
            }
        }
    }
}

pub fn verify_conservation(inputs: &[&OmniaVtxo], outputs: &[&OmniaVtxo], mode: &str) -> VerifyVtxoResult {
    let input_sum: u128 = inputs.iter().filter_map(|v| v.amount.parse::<u128>().ok()).sum();
    let output_sum: u128 = outputs.iter().filter_map(|v| v.amount.parse::<u128>().ok()).sum();

    match mode {
        "strict" => {
            if input_sum == output_sum {
                VerifyVtxoResult { valid: true, reason: None }
            } else {
                VerifyVtxoResult {
                    valid: false,
                    reason: Some(format!("conservation failed: inputs={} outputs={}", input_sum, output_sum)),
                }
            }
        }
        "lte" => {
            if output_sum <= input_sum {
                VerifyVtxoResult { valid: true, reason: None }
            } else {
                VerifyVtxoResult {
                    valid: false,
                    reason: Some(format!("outputs ({}) exceed inputs ({})", output_sum, input_sum)),
                }
            }
        }
        _ => VerifyVtxoResult { valid: false, reason: Some(format!("unknown conservation mode: {}", mode)) },
    }
}
