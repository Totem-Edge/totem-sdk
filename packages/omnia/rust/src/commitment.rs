use sha3::{Digest, Sha3_256};
use std::collections::HashMap;

use crate::types::HTLCRecord;

pub fn compute_state_commitment(
    sequence: u32,
    balances: &HashMap<String, String>,
    pending_htlcs: &[HTLCRecord],
) -> Vec<u8> {
    let mut sorted_balances: Vec<(&String, &String)> = balances.iter().collect();
    sorted_balances.sort_by(|a, b| a.0.cmp(b.0));

    let mut sorted_htlcs: Vec<&HTLCRecord> = pending_htlcs.iter().collect();
    sorted_htlcs.sort_by(|a, b| a.htlc_id.cmp(&b.htlc_id));

    let mut hasher = Sha3_256::new();

    hasher.update(&sequence.to_le_bytes());

    for (party_id, balance) in &sorted_balances {
        hasher.update(party_id.as_bytes());
        hasher.update(balance.as_bytes());
    }

    for htlc in &sorted_htlcs {
        hasher.update(htlc.htlc_id.as_bytes());
        hasher.update(htlc.amount.as_bytes());
        hasher.update(htlc.hashlock.as_bytes());
        hasher.update(htlc.timeout_block.as_bytes());
        hasher.update(htlc.status.as_bytes());
    }

    hasher.finalize().to_vec()
}

pub fn compute_tx_draft_digest(
    tx_type: &str,
    inputs: &[serde_json::Value],
    outputs: &[serde_json::Value],
    state_variables: &[serde_json::Value],
) -> Vec<u8> {
    let canonical = serde_json::json!({
        "type": tx_type,
        "inputs": inputs,
        "outputs": outputs,
        "stateVariables": state_variables,
    });
    let input = serde_json::to_string(&canonical).unwrap_or_default();
    let mut hasher = Sha3_256::new();
    hasher.update(input.as_bytes());
    hasher.finalize().to_vec()
}
