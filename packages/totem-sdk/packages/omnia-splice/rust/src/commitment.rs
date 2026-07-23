use sha3::{Digest, Sha3_256};
use std::collections::HashMap;

use crate::types::{SpliceParams, SpliceTxDraft, ValidationResult};

pub fn compute_splice_tx_digest(draft: &SpliceTxDraft) -> Vec<u8> {
    let mut sorted_balances: Vec<(&String, &String)> = draft.params.new_balances.iter().collect();
    sorted_balances.sort_by(|a, b| a.0.cmp(b.0));
    let balance_entries: Vec<(&str, &str)> = sorted_balances.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();

    let canonical = serde_json::json!({
        "channelId": draft.channel_id,
        "inputs": draft.inputs.iter().map(|i| serde_json::json!({
            "coinId": i.coin_id,
            "address": i.address,
            "amount": i.amount,
            "tokenId": i.token_id,
        })).collect::<Vec<_>>(),
        "outputs": draft.outputs.iter().map(|o| serde_json::json!({
            "address": o.address,
            "amount": o.amount,
            "tokenId": o.token_id,
            "storeState": o.store_state,
            "stateVarSettlement": if o.store_state { Some(o.state_var_settlement) } else { None },
            "stateVarSequence": if o.store_state { Some(o.state_var_sequence) } else { None },
        })).collect::<Vec<_>>(),
        "params": {
            "type": draft.params.splice_type,
            "newTotalValue": draft.params.new_total_value,
            "newBalances": balance_entries,
        },
    });

    let input = serde_json::to_string(&canonical).unwrap_or_default();
    let mut hasher = Sha3_256::new();
    hasher.update(input.as_bytes());
    hasher.finalize().to_vec()
}

pub fn scale_balances(
    balances: &HashMap<String, String>,
    old_total: &str,
    new_total: &str,
) -> Result<HashMap<String, String>, String> {
    let ot: u128 = old_total.parse().map_err(|_| "invalid oldTotal".to_string())?;
    let nt: u128 = new_total.parse().map_err(|_| "invalid newTotal".to_string())?;

    if ot == 0 {
        let party_ids: Vec<&String> = balances.keys().collect();
        if party_ids.is_empty() {
            return Ok(HashMap::new());
        }
        let each = nt / party_ids.len() as u128;
        let mut result = HashMap::new();
        let mut assigned = 0u128;
        for i in 0..party_ids.len() - 1 {
            result.insert(party_ids[i].clone(), each.to_string());
            assigned += each;
        }
        let last = party_ids[party_ids.len() - 1].clone();
        result.insert(last, (nt - assigned).to_string());
        return Ok(result);
    }

    let party_ids: Vec<&String> = balances.keys().collect();
    let mut result = HashMap::new();
    let mut assigned = 0u128;
    for i in 0..party_ids.len() - 1 {
        let pid = party_ids[i];
        let prev: u128 = balances.get(pid).and_then(|v| v.parse().ok()).unwrap_or(0);
        let scaled = (prev * nt) / ot;
        result.insert(pid.clone(), scaled.to_string());
        assigned += scaled;
    }
    let last = party_ids[party_ids.len() - 1].clone();
    result.insert(last, (nt - assigned).to_string());
    Ok(result)
}

pub fn validate_splice_params(
    total_value: &str,
    params: &SpliceParams,
) -> ValidationResult {
    let balance_sum: u128 = params.new_balances.values().filter_map(|v| v.parse::<u128>().ok()).sum();
    let ntv: u128 = params.new_total_value.parse().unwrap_or(0);

    if balance_sum != ntv {
        return ValidationResult {
            valid: false,
            reason: Some(format!("newBalances sum ({}) != newTotalValue ({})", balance_sum, ntv)),
        };
    }

    if params.splice_type == "splice_out" {
        let tv: u128 = total_value.parse().unwrap_or(0);
        let withdraw: u128 = params.withdraw_amount.as_deref().unwrap_or("0").parse().unwrap_or(0);
        if withdraw > tv {
            return ValidationResult {
                valid: false,
                reason: Some(format!("withdrawAmount ({}) exceeds totalValue ({})", withdraw, tv)),
            };
        }
    }

    ValidationResult { valid: true, reason: None }
}
