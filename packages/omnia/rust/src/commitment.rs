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

    hasher.update(sequence.to_le_bytes());

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

/// Canonical state commitment v2 — byte-identical to the TS
/// `computeStateCommitmentV2` (including the port-102 exclusion and JSON encoding).
///
/// The payload is serialised with `serde_json`, whose object maps are sorted, which
/// matches the TS `canonicalJson` (keys sorted at every level).
thread_local! {
    static STATE_COMMITMENT_V2_INPUT: std::cell::RefCell<String> = const { std::cell::RefCell::new(String::new()) };
}

// Last canonical JSON payload produced by `compute_state_commitment_v2`
// (diagnostics/parity only).
pub fn last_state_commitment_v2_input() -> String {
    STATE_COMMITMENT_V2_INPUT.with(|c| c.borrow().clone())
}

pub fn compute_state_commitment_v2(
    channel: &crate::types::OmniaChannel,
    sequence: u32,
    balances: &HashMap<String, String>,
    pending_htlcs: &[HTLCRecord],
    settlement: bool,
    program_state_variables: &[crate::types::StateValue],
) -> Vec<u8> {
    use serde_json::json;

    let mut script_hasher = Sha3_256::new();
    script_hasher.update(channel.funding_script.trim().to_uppercase().as_bytes());
    let funding_script_hash = format!("0x{}", hex::encode(script_hasher.finalize()));

    let balances_value: serde_json::Map<String, serde_json::Value> = balances
        .iter()
        .map(|(party, balance)| (party.clone(), json!(balance)))
        .collect();

    let mut htlcs: Vec<&HTLCRecord> = pending_htlcs
        .iter()
        .filter(|h| h.status == "pending")
        .collect();
    htlcs.sort_by(|a, b| a.htlc_id.cmp(&b.htlc_id));
    let htlcs_value: Vec<serde_json::Value> = htlcs
        .iter()
        .map(|h| {
            json!({
                "htlcId": h.htlc_id,
                "amount": h.amount,
                "hashlock": h.hashlock,
                "timeoutBlock": h.timeout_block,
                "direction": h.direction,
                "htlcAddress": h.htlc_address,
                "senderPublicKeyDigest": h.sender_public_key_digest,
                "recipientPublicKeyDigest": h.recipient_public_key_digest,
            })
        })
        .collect();

    let mut program_vars: Vec<&crate::types::StateValue> = program_state_variables
        .iter()
        .filter(|sv| !matches!(sv.port, 100 | 101 | 102))
        .collect();
    program_vars.sort_by_key(|sv| sv.port);
    let program_vars_value: Vec<serde_json::Value> = program_vars
        .iter()
        .map(|sv| {
            let value = match &sv.value {
                serde_json::Value::String(text) => text.clone(),
                other => other.to_string(),
            };
            json!({
                "port": sv.port,
                "type": sv.value_type,
                "value": value,
            })
        })
        .collect();

    let payload = json!({
        "version": 2,
        "channelId": channel.channel_id,
        "fundingAddress": channel.funding_address,
        "fundingScriptHash": funding_script_hash,
        "tokenId": channel.token_id,
        "tokenScale": channel.token_scale,
        "totalValue": channel.total_value,
        "sequence": sequence,
        "settlement": settlement,
        "balances": balances_value,
        "htlcs": htlcs_value,
        "programStateVariables": program_vars_value,
    });

    let input = serde_json::to_string(&payload).unwrap_or_default();
    STATE_COMMITMENT_V2_INPUT.with(|c| *c.borrow_mut() = input.clone());
    let mut hasher = Sha3_256::new();
    hasher.update(input.as_bytes());
    hasher.finalize().to_vec()
}
