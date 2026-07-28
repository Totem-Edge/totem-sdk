use std::collections::{HashMap, HashSet};

use crate::capacity::flat_signing_index;
use crate::commitment::compute_state_commitment;
use crate::types::{
    HTLCRecord, OmniaChannel, SignedChannelState, ValidationResult,
    VerifyStateResult,
};

pub fn validate_balance_conservation(
    total_value: &str,
    balances: &HashMap<String, String>,
    pending_htlcs: &[HTLCRecord],
) -> ValidationResult {
    let tv: u128 = match total_value.parse() {
        Ok(v) => v,
        Err(_) => return ValidationResult { valid: false, reason: Some("Invalid totalValue".to_string()) },
    };

    let balance_sum: u128 = balances.values().filter_map(|v| v.parse::<u128>().ok()).sum();

    let htlc_total: u128 = pending_htlcs
        .iter()
        .filter(|h| h.status == "pending")
        .filter_map(|h| h.amount.parse::<u128>().ok())
        .sum();

    if balance_sum + htlc_total != tv {
        return ValidationResult {
            valid: false,
            reason: Some(format!(
                "Balance conservation failed: {} + {} != {}",
                balance_sum, htlc_total, tv
            )),
        };
    }

    for (party_id, balance) in balances {
        if let Ok(b) = balance.parse::<i128>() {
            if b < 0 {
                return ValidationResult {
                    valid: false,
                    reason: Some(format!("Negative balance for {}: {}", party_id, b)),
                };
            }
        }
    }

    ValidationResult { valid: true, reason: None }
}

pub fn validate_complete_channel_state(
    channel: &OmniaChannel,
    state: &SignedChannelState,
) -> ValidationResult {
    let party_ids: HashSet<&String> = channel.parties.iter().map(|p| &p.party_id).collect();
    let balance_keys: HashSet<&String> = state.balances.keys().collect();

    if balance_keys.len() != party_ids.len() {
        return ValidationResult {
            valid: false,
            reason: Some(format!(
                "Balance map has {} keys, expected {} (channel participants)",
                balance_keys.len(),
                party_ids.len()
            )),
        };
    }
    for key in &balance_keys {
        if !party_ids.contains(*key) {
            return ValidationResult {
                valid: false,
                reason: Some(format!("Balance key '{}' is not a channel participant", key)),
            };
        }
    }

    let pkds: HashSet<&String> = channel.parties.iter().map(|p| &p.public_key_digest).collect();
    if pkds.len() != channel.parties.len() {
        return ValidationResult {
            valid: false,
            reason: Some("Duplicate public key digests in channel parties".to_string()),
        };
    }

    for (party_id, balance) in &state.balances {
        if let Ok(b) = balance.parse::<i128>() {
            if b < 0 {
                return ValidationResult {
                    valid: false,
                    reason: Some(format!("Negative balance for {}: {}", party_id, b)),
                };
            }
        }
    }

    let conservation = validate_balance_conservation(
        &channel.total_value,
        &state.balances,
        &state.pending_htlcs,
    );
    if !conservation.valid {
        return conservation;
    }

    if state.sequence == 0 {
        return ValidationResult {
            valid: false,
            reason: Some(format!("Sequence must be positive: {}", state.sequence)),
        };
    }

    for party in &channel.parties {
        if !state.signatures.contains_key(&party.party_id) {
            return ValidationResult {
                valid: false,
                reason: Some(format!("Missing signature for party {}", party.party_id)),
            };
        }
    }

    for (party_id, _sig) in &state.signatures {
        if !channel.parties.iter().any(|p| &p.party_id == party_id) {
            return ValidationResult {
                valid: false,
                reason: Some(format!(
                    "Signature party '{}' not found in channel parties",
                    party_id
                )),
            };
        }
    }

    if let Some(ref latest) = channel.latest_state {
        for party in &channel.parties {
            if let (Some(prev), Some(new)) = (
                latest.signing_indices.get(&party.party_id),
                state.signing_indices.get(&party.party_id),
            ) {
                let prev_flat = flat_signing_index(prev.l1, prev.l2);
                let new_flat = flat_signing_index(new.l1, new.l2);
                if new_flat <= prev_flat {
                    return ValidationResult {
                        valid: false,
                        reason: Some(format!(
                            "WOTS index not monotonic for {}: {} <= {}",
                            party.party_id, new_flat, prev_flat
                        )),
                    };
                }
            }
        }
    }

    if state.transaction_hex.is_empty() {
        return ValidationResult {
            valid: false,
            reason: Some("Missing transactionHex in signed state".to_string()),
        };
    }

    ValidationResult { valid: true, reason: None }
}

pub fn verify_state(
    channel: &OmniaChannel,
    state: &SignedChannelState,
    verify_sig_fn: &dyn Fn(&str, &[u8], &str) -> bool,
) -> VerifyStateResult {
    let mut errors: Vec<String> = Vec::new();

    if state.sequence <= channel.current_sequence {
        errors.push(format!(
            "sequence {} not > current {}",
            state.sequence, channel.current_sequence
        ));
    }

    let conservation = validate_balance_conservation(
        &channel.total_value,
        &state.balances,
        &state.pending_htlcs,
    );
    if !conservation.valid {
        if let Some(reason) = &conservation.reason {
            errors.push(reason.clone());
        }
    }

    for party in &channel.parties {
        let sig = state.signatures.get(&party.party_id);
        let indices = state.signing_indices.get(&party.party_id);

        if sig.is_none() || indices.is_none() {
            errors.push(format!(
                "missing signature/indices for party {}",
                party.party_id
            ));
            continue;
        }

        let commitment = compute_state_commitment(
            state.sequence,
            &state.balances,
            &state.pending_htlcs,
        );

        if !verify_sig_fn(sig.unwrap(), &commitment, &party.public_key_digest) {
            errors.push(format!(
                "invalid WOTS signature for party {}",
                party.party_id
            ));
        }

        if let Some(ref latest) = channel.latest_state {
            if let (Some(prev), Some(new)) = (
                latest.signing_indices.get(&party.party_id),
                indices,
            ) {
                let prev_flat = flat_signing_index(prev.l1, prev.l2);
                let new_flat = flat_signing_index(new.l1, new.l2);
                if new_flat <= prev_flat {
                    errors.push(format!(
                        "signing index not monotone for party {}: {} <= {}",
                        party.party_id, new_flat, prev_flat
                    ));
                }
            }
        }
    }

    VerifyStateResult {
        valid: errors.is_empty(),
        errors,
    }
}

pub fn validate_state_transition(
    channel: &OmniaChannel,
    new_sequence: u32,
    new_balances: &HashMap<String, String>,
    pending_htlc_delta: &str,
) -> Result<(), String> {
    if new_sequence <= channel.current_sequence {
        return Err(format!(
            "Sequence must be strictly greater than current: current={}, proposed={}",
            channel.current_sequence, new_sequence
        ));
    }

    let tv: u128 = channel.total_value.parse().map_err(|_| "Invalid totalValue".to_string())?;
    let delta: u128 = pending_htlc_delta.parse().map_err(|_| "Invalid pendingHTLCDelta".to_string())?;

    let htlc_total: u128 = channel
        .pending_htlcs
        .iter()
        .filter(|h| h.status == "pending")
        .filter_map(|h| h.amount.parse::<u128>().ok())
        .sum::<u128>()
        + delta;

    let balance_sum: u128 = new_balances
        .values()
        .filter_map(|v| v.parse::<u128>().ok())
        .sum();

    if balance_sum + htlc_total != tv {
        return Err(format!(
            "Balance conservation violated: totalValue={}, sum(balances+htlcs)={}",
            tv,
            balance_sum + htlc_total
        ));
    }

    Ok(())
}

pub fn verify_htlc_preimage(preimage: &str, hashlock: &str) -> bool {
    use sha3::{Digest, Sha3_256};
    let mut hasher = Sha3_256::new();
    hasher.update(preimage.as_bytes());
    let digest = hex::encode(hasher.finalize());
    digest == hashlock
}
