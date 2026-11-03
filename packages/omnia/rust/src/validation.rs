use std::collections::HashMap;

use crate::capacity::flat_signing_index;
use crate::types::{
    HTLCRecord, OmniaChannel, SignedChannelState, ValidationResult, VerifyStateResult,
};

fn parse_amount(value: &str, label: &str) -> Result<i128, String> {
    value
        .parse::<i128>()
        .map_err(|_| format!("Invalid {}: {value:?}", label))
}

pub fn validate_balance_conservation(
    total_value: &str,
    balances: &HashMap<String, String>,
    pending_htlcs: &[HTLCRecord],
) -> ValidationResult {
    let tv = match parse_amount(total_value, "totalValue") {
        Ok(v) => v,
        Err(reason) => {
            return ValidationResult {
                valid: false,
                reason: Some(reason),
            }
        }
    };

    // Strict parsing: a malformed value must fail, not contribute zero.
    let mut balance_sum: i128 = 0;
    for (party_id, balance) in balances {
        let parsed = match parse_amount(balance, &format!("balance for {party_id}")) {
            Ok(v) => v,
            Err(reason) => {
                return ValidationResult {
                    valid: false,
                    reason: Some(reason),
                }
            }
        };
        if parsed < 0 {
            return ValidationResult {
                valid: false,
                reason: Some(format!("Negative balance for {party_id}: {parsed}")),
            };
        }
        balance_sum += parsed;
    }

    let mut htlc_total: i128 = 0;
    for htlc in pending_htlcs.iter().filter(|h| h.status == "pending") {
        let parsed = match parse_amount(&htlc.amount, &format!("HTLC amount for {}", htlc.htlc_id))
        {
            Ok(v) => v,
            Err(reason) => {
                return ValidationResult {
                    valid: false,
                    reason: Some(reason),
                }
            }
        };
        if parsed < 0 {
            return ValidationResult {
                valid: false,
                reason: Some(format!(
                    "Negative HTLC amount for {}: {parsed}",
                    htlc.htlc_id
                )),
            };
        }
        htlc_total += parsed;
    }

    if balance_sum + htlc_total != tv {
        return ValidationResult {
            valid: false,
            reason: Some(format!(
                "Balance conservation failed: {balance_sum} + {htlc_total} != {tv}"
            )),
        };
    }

    ValidationResult {
        valid: true,
        reason: None,
    }
}

const PORT_SETTLEMENT: u32 = 100;
const PORT_SEQUENCE: u32 = 101;
const PORT_COMMITMENT: u32 = 102;

fn commitment_hex(channel: &OmniaChannel, state: &SignedChannelState, settlement: bool) -> String {
    let digest = crate::commitment::compute_state_commitment_v2(
        channel,
        state.sequence,
        &state.balances,
        &state.pending_htlcs,
        settlement,
        &state.state_variables,
    );
    crate::serialize::bytes_to_hex(&digest)
}

fn state_variable_string(state: &SignedChannelState, port: u32) -> Option<String> {
    state
        .state_variables
        .iter()
        .find(|value| value.port == port)
        .map(|value| match &value.value {
            serde_json::Value::String(text) => text.clone(),
            other => other.to_string(),
        })
}

fn normalize_value(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(text) => {
            text.strip_prefix("__bigint__").unwrap_or(text).to_string()
        }
        serde_json::Value::Bool(flag) => flag.to_string(),
        serde_json::Value::Number(number) => number.to_string(),
        serde_json::Value::Null => "null".to_string(),
        other => other.to_string(),
    }
}

fn state_variables_equal(
    left: &[crate::types::StateValue],
    right: &[crate::types::StateValue],
) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.iter().zip(right.iter()).all(|(a, b)| {
        a.port == b.port
            && a.value_type == b.value_type
            && normalize_value(&a.value) == normalize_value(&b.value)
    })
}

fn settlement_variables(
    channel: &OmniaChannel,
    state: &SignedChannelState,
) -> Vec<crate::types::StateValue> {
    let commitment = commitment_hex(channel, state, true);
    state
        .state_variables
        .iter()
        .map(|value| match value.port {
            PORT_SETTLEMENT => crate::types::StateValue {
                port: value.port,
                value: serde_json::Value::Bool(true),
                value_type: "bool".to_string(),
            },
            PORT_SEQUENCE => crate::types::StateValue {
                port: value.port,
                value: serde_json::Value::String(format!("__bigint__{}", state.sequence)),
                value_type: "number".to_string(),
            },
            PORT_COMMITMENT => crate::types::StateValue {
                port: value.port,
                value: serde_json::Value::String(commitment.clone()),
                value_type: "hex".to_string(),
            },
            _ => value.clone(),
        })
        .collect()
}

fn raw_total(channel: &OmniaChannel) -> Result<u128, String> {
    let total =
        crate::serialize::parse_amount(&serde_json::Value::String(channel.total_value.clone()))?;
    let scale = channel.token_scale;
    if scale == 0 {
        return Ok(total);
    }
    let divisor = 10u128
        .checked_pow(scale)
        .ok_or_else(|| "tokenScale out of range".to_string())?;
    if total % divisor != 0 {
        return Err(format!(
            "totalValue {total} is not divisible by tokenScale {scale}"
        ));
    }
    Ok(total / divisor)
}

fn verify_artifact(
    channel: &OmniaChannel,
    state: &SignedChannelState,
    artifact: &crate::types::ClosePackageArtifact,
    settlement: bool,
    errors: &mut Vec<String>,
) {
    let draft = match crate::serialize::draft_from_hex(&artifact.tx_hex) {
        Ok(draft) => draft,
        Err(error) => {
            errors.push(format!("close package tx is not a valid draft: {error}"));
            return;
        }
    };
    let digest = match crate::serialize::digest_from_hex(&artifact.tx_hex) {
        Ok(digest) => digest,
        Err(error) => {
            errors.push(format!("close package tx cannot be hashed: {error}"));
            return;
        }
    };
    if crate::serialize::normalize_hex(&artifact.tx_digest)
        != crate::serialize::normalize_hex(&crate::serialize::bytes_to_hex(&digest))
    {
        errors.push("close package tx digest mismatch".to_string());
    }

    let expected_variables = if settlement {
        settlement_variables(channel, state)
    } else {
        state.state_variables.clone()
    };
    if !state_variables_equal(&draft.state_variables, &expected_variables) {
        errors.push("close package state variables do not match the signed state".to_string());
    }

    match raw_total(channel) {
        Err(error) => errors.push(error),
        Ok(total) => {
            if settlement {
                let mut output_total: u128 = 0;
                for output in &draft.outputs {
                    match crate::serialize::parse_amount(&output.amount) {
                        Ok(amount) => output_total += amount,
                        Err(error) => {
                            errors.push(format!("settlement output amount invalid: {error}"))
                        }
                    }
                }
                if output_total != total {
                    errors.push(format!(
                        "settlement outputs sum to {output_total}, expected {total}"
                    ));
                }
            } else {
                if draft.outputs.len() != 1 {
                    errors.push("update tx must have exactly one channel output".to_string());
                } else {
                    let output = &draft.outputs[0];
                    if !output
                        .address
                        .eq_ignore_ascii_case(&channel.funding_address)
                    {
                        errors.push("update output is not the channel script address".to_string());
                    }
                    if crate::serialize::parse_amount(&output.amount).ok() != Some(total) {
                        errors.push(
                            "update output amount does not equal the channel total".to_string(),
                        );
                    }
                }
            }
        }
    }

    for party in &channel.parties {
        let signature = match artifact.signatures.get(&party.party_id) {
            Some(signature) => signature,
            None => {
                errors.push(format!(
                    "missing {} close artifact signature for {}",
                    if settlement { "settlement" } else { "update" },
                    party.party_id
                ));
                continue;
            }
        };
        if artifact.signing_indices.get(&party.party_id).is_none() {
            errors.push(format!(
                "missing close artifact signing indices for {}",
                party.party_id
            ));
        }
        match crate::signature::verify_signature_hex(signature, &digest, &party.public_key_digest) {
            Ok(true) => {}
            _ => errors.push(format!(
                "invalid {} close artifact signature for {}",
                if settlement { "settlement" } else { "update" },
                party.party_id
            )),
        }
    }
}

fn verify_close_package(
    channel: &OmniaChannel,
    state: &SignedChannelState,
    errors: &mut Vec<String>,
) {
    let close_package = match &state.close_package {
        Some(close_package) => close_package,
        None => {
            errors.push("missing close package".to_string());
            return;
        }
    };
    if close_package.version != 1 {
        errors.push(format!(
            "unsupported close package version {}",
            close_package.version
        ));
    }
    if close_package.channel_id != channel.channel_id {
        errors.push("close package channelId mismatch".to_string());
    }
    if close_package.sequence != state.sequence {
        errors.push("close package sequence mismatch".to_string());
    }
    if crate::serialize::normalize_hex(&close_package.state_commitment_v2)
        != crate::serialize::normalize_hex(&commitment_hex(channel, state, false))
    {
        errors.push("close package stateCommitmentV2 mismatch".to_string());
    }

    verify_artifact(channel, state, &close_package.update, false, errors);
    verify_artifact(channel, state, &close_package.settlement, true, errors);
}

/// All state invariants that can be checked without the TypeScript program
/// registry: conservation, commitment-v2, the signed transaction bytes, the
/// close package and every party signature.
pub fn verify_state_checks(channel: &OmniaChannel, state: &SignedChannelState) -> Vec<String> {
    let mut errors: Vec<String> = Vec::new();

    if state.sequence <= channel.current_sequence {
        errors.push(format!(
            "sequence {} not > current {}",
            state.sequence, channel.current_sequence
        ));
    }

    let conservation =
        validate_balance_conservation(&channel.total_value, &state.balances, &state.pending_htlcs);
    if !conservation.valid {
        errors.push(
            conservation
                .reason
                .unwrap_or_else(|| "balance conservation failed".to_string()),
        );
    }

    match state_variable_string(state, PORT_COMMITMENT) {
        None => errors.push("missing state commitment v2".to_string()),
        Some(declared) => {
            if crate::serialize::normalize_hex(&declared)
                != crate::serialize::normalize_hex(&commitment_hex(channel, state, false))
            {
                errors.push("state commitment v2 mismatch".to_string());
            }
        }
    }

    let update_digest = match crate::serialize::digest_from_hex(&state.transaction_hex) {
        Ok(digest) => Some(digest),
        Err(error) => {
            errors.push(format!("invalid update transaction bytes: {error}"));
            None
        }
    };
    if let Ok(draft) = crate::serialize::draft_from_hex(&state.transaction_hex) {
        if !state_variables_equal(&draft.state_variables, &state.state_variables) {
            errors.push("transaction state variables do not match the signed state".to_string());
        }
    }

    verify_close_package(channel, state, &mut errors);

    if let Some(digest) = update_digest {
        for party in &channel.parties {
            match state.signatures.get(&party.party_id) {
                None => errors.push(format!("missing signature for party {}", party.party_id)),
                Some(signature) => {
                    if state.signing_indices.get(&party.party_id).is_none() {
                        errors.push(format!(
                            "missing signing indices for party {}",
                            party.party_id
                        ));
                    }
                    match crate::signature::verify_signature_hex(
                        signature,
                        &digest,
                        &party.public_key_digest,
                    ) {
                        Ok(true) => {}
                        _ => errors.push(format!(
                            "invalid WOTS signature for party {}",
                            party.party_id
                        )),
                    }
                }
            }
        }
    }

    if let Some(latest) = &channel.latest_state {
        for party in &channel.parties {
            if let (Some(previous), Some(next)) = (
                latest.signing_indices.get(&party.party_id),
                state.signing_indices.get(&party.party_id),
            ) {
                let previous_flat = flat_signing_index(previous.l1, previous.l2);
                let next_flat = flat_signing_index(next.l1, next.l2);
                if next_flat <= previous_flat {
                    errors.push(format!(
                        "signing index not monotone for party {}: {} <= {}",
                        party.party_id, next_flat, previous_flat
                    ));
                }
            }
        }
    }

    errors
}

pub fn validate_complete_channel_state(
    channel: &OmniaChannel,
    state: &SignedChannelState,
) -> ValidationResult {
    let errors = verify_state_checks(channel, state);
    match errors.into_iter().next() {
        Some(reason) => ValidationResult {
            valid: false,
            reason: Some(reason),
        },
        None => ValidationResult {
            valid: true,
            reason: None,
        },
    }
}

pub fn verify_state(channel: &OmniaChannel, state: &SignedChannelState) -> VerifyStateResult {
    let errors = verify_state_checks(channel, state);
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

    let tv = parse_amount(&channel.total_value, "totalValue")?;
    // A fulfilment or timeout shrinks the pending total, so the delta may be negative.
    let delta = parse_amount(pending_htlc_delta, "pendingHTLCDelta")?;

    let mut htlc_total: i128 = delta;
    for htlc in channel
        .pending_htlcs
        .iter()
        .filter(|h| h.status == "pending")
    {
        let amount = parse_amount(&htlc.amount, &format!("HTLC amount for {}", htlc.htlc_id))?;
        if amount < 0 {
            return Err(format!(
                "Negative HTLC amount for {}: {amount}",
                htlc.htlc_id
            ));
        }
        htlc_total += amount;
    }

    let mut balance_sum: i128 = 0;
    for (party_id, balance) in new_balances {
        let parsed = parse_amount(balance, &format!("balance for {party_id}"))?;
        if parsed < 0 {
            return Err(format!("Negative balance for {party_id}: {parsed}"));
        }
        balance_sum += parsed;
    }

    if balance_sum + htlc_total != tv {
        return Err(format!(
            "Balance conservation violated: totalValue={tv}, sum(balances+htlcs)={}",
            balance_sum + htlc_total
        ));
    }

    Ok(())
}

pub fn verify_htlc_preimage(preimage: &str, hashlock: &str) -> bool {
    use sha3::{Digest, Sha3_256};

    // The SDK hashes the raw preimage bytes (hex-decoded) and compares the hex
    // digest case-insensitively; hashing the UTF-8 hex text is a different value.
    let strip = |h: &str| {
        h.strip_prefix("0x")
            .or_else(|| h.strip_prefix("0X"))
            .unwrap_or(h)
            .to_string()
    };
    let bytes = match hex::decode(strip(preimage)) {
        Ok(b) => b,
        Err(_) => return false,
    };
    let mut hasher = Sha3_256::new();
    hasher.update(&bytes);
    hex::encode(hasher.finalize()).eq_ignore_ascii_case(&strip(hashlock))
}
