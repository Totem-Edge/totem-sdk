use serde_json::Value;

use crate::state_vars::{
    get_state_bigint, get_state_bool, get_state_hex, get_state_string, normalize_hex,
    preimage_digest, program_bool_state, program_hex_state, program_number_state,
    program_string_state,
};
use crate::types::{
    OmniaChannel, ProgramTransition, SignedChannelState, StateValue, ValidationResult,
};

pub const ELTOO_PAYMENT_PROGRAM_ID: &str = "eltoo-payment";
pub const COUNTER_PROGRAM_ID: &str = "counter";
pub const COUNTER_STATE_PORT: u32 = 120;
pub const COUNTER_ACTION_PORT: u32 = 121;
pub const COUNTER_OPERAND_PORT: u32 = 122;
pub const COUNTER_ACTION_NONE: i128 = 0;
pub const COUNTER_ACTION_INCREMENT: i128 = 1;
pub const COUNTER_ACTION_DECREMENT: i128 = 2;
pub const COUNTER_ACTION_SET: i128 = 3;
pub const METER_PROGRAM_ID: &str = "meter";
pub const METER_READING_PORT: u32 = 130;
pub const METER_USAGE_DELTA_PORT: u32 = 131;
pub const METER_UNIT_PRICE_PORT: u32 = 132;
pub const METER_PAYMENT_PORT: u32 = 133;

pub const HTLC_PROGRAM_ID: &str = "htlc-payment";
pub const HTLC_HASHLOCK_PORT: u32 = 140;
pub const HTLC_LOCKED_AMOUNT_PORT: u32 = 141;
pub const HTLC_TIMEOUT_BLOCK_PORT: u32 = 142;
pub const HTLC_CLAIMED_PORT: u32 = 143;

pub const VAULT_PROGRAM_ID: &str = "vault";
pub const VAULT_LOCKED_VALUE_PORT: u32 = 150;
pub const VAULT_RELEASE_SEQUENCE_PORT: u32 = 151;
pub const VAULT_SWEPT_PORT: u32 = 152;

pub const TREASURY_PROGRAM_ID: &str = "treasury";
pub const TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT: u32 = 160;
pub const TREASURY_VOTE_TALLY_HASH_PORT: u32 = 161;
pub const TREASURY_SPEND_CAP_PORT: u32 = 162;
pub const TREASURY_SPENT_PORT: u32 = 163;
pub const TREASURY_OUTCOME_PROOF_ID_PORT: u32 = 164;

pub const MEMBERSHIP_PROGRAM_ID: &str = "membership";
pub const MEMBERSHIP_MEMBER_ROOT_PORT: u32 = 170;
pub const MEMBERSHIP_DIVIDEND_POOL_PORT: u32 = 171;
pub const MEMBERSHIP_PAYOUT_SEQUENCE_PORT: u32 = 172;

pub const ASSET_PROGRAM_ID: &str = "asset";
pub const ASSET_TOKEN_ID_PORT: u32 = 180;
pub const ASSET_HOLDER_A_BALANCE_PORT: u32 = 181;
pub const ASSET_HOLDER_B_BALANCE_PORT: u32 = 182;
pub const ASSET_TOTAL_PORT: u32 = 183;

fn valid() -> ValidationResult {
    ValidationResult {
        valid: true,
        reason: None,
    }
}

fn invalid(reason: impl Into<String>) -> ValidationResult {
    ValidationResult {
        valid: false,
        reason: Some(reason.into()),
    }
}

fn input_bigint(
    transition: Option<&ProgramTransition>,
    key: &str,
    fallback: i128,
) -> Result<i128, String> {
    let Some(transition) = transition else {
        return Ok(fallback);
    };
    let Some(inputs) = transition.inputs.as_ref() else {
        return Ok(fallback);
    };
    let Some(value) = inputs.get(key) else {
        return Ok(fallback);
    };
    match value {
        Value::String(value) => value.parse::<i128>().map_err(|e| e.to_string()),
        Value::Number(value) => value
            .as_i64()
            .map(i128::from)
            .ok_or_else(|| format!("Invalid integer input {}", key)),
        Value::Bool(value) => Err(format!("invalid digit found in string: {}", value)),
        other => Err(format!("Invalid integer input {}: {}", key, other)),
    }
}

fn state_bigint_or_validation(
    state: Option<&SignedChannelState>,
    port: u32,
    fallback: i128,
) -> Result<i128, ValidationResult> {
    get_state_bigint(state, port, fallback).map_err(invalid)
}

fn balance_bigint(balance: Option<&String>, fallback: i128) -> Result<i128, ValidationResult> {
    match balance {
        Some(value) => value.parse::<i128>().map_err(|e| invalid(e.to_string())),
        None => Ok(fallback),
    }
}

pub fn default_eltoo_payment_state_variables() -> Vec<StateValue> {
    vec![]
}

pub fn build_counter_state_variables(
    previous_state: Option<&SignedChannelState>,
    transition: Option<&ProgramTransition>,
) -> Result<Vec<StateValue>, String> {
    let current = get_state_bigint(previous_state, COUNTER_STATE_PORT, 0)?;
    match transition.map(|t| t.action.as_str()) {
        None => Ok(vec![
            program_number_state(COUNTER_STATE_PORT, current)?,
            program_number_state(COUNTER_ACTION_PORT, COUNTER_ACTION_NONE)?,
            program_number_state(COUNTER_OPERAND_PORT, 0)?,
        ]),
        Some("increment") => {
            let by = input_bigint(transition, "by", 1)?;
            Ok(vec![
                program_number_state(COUNTER_STATE_PORT, current + by)?,
                program_number_state(COUNTER_ACTION_PORT, COUNTER_ACTION_INCREMENT)?,
                program_number_state(COUNTER_OPERAND_PORT, by)?,
            ])
        }
        Some("decrement") => {
            let by = input_bigint(transition, "by", 1)?;
            Ok(vec![
                program_number_state(COUNTER_STATE_PORT, current - by)?,
                program_number_state(COUNTER_ACTION_PORT, COUNTER_ACTION_DECREMENT)?,
                program_number_state(COUNTER_OPERAND_PORT, by)?,
            ])
        }
        Some("set") => {
            let value = input_bigint(transition, "value", current)?;
            Ok(vec![
                program_number_state(COUNTER_STATE_PORT, value)?,
                program_number_state(COUNTER_ACTION_PORT, COUNTER_ACTION_SET)?,
                program_number_state(COUNTER_OPERAND_PORT, value)?,
            ])
        }
        Some(_) => Ok(vec![
            program_number_state(COUNTER_STATE_PORT, current)?,
            program_number_state(COUNTER_ACTION_PORT, COUNTER_ACTION_NONE)?,
            program_number_state(COUNTER_OPERAND_PORT, 0)?,
        ]),
    }
}

pub fn validate_counter_transition(
    previous_state: Option<&SignedChannelState>,
    next_state: &SignedChannelState,
    transition: Option<&ProgramTransition>,
) -> ValidationResult {
    let Some(transition) = transition else {
        return valid();
    };
    let current = match state_bigint_or_validation(previous_state, COUNTER_STATE_PORT, 0) {
        Ok(value) => value,
        Err(result) => return result,
    };
    let next = match state_bigint_or_validation(Some(next_state), COUNTER_STATE_PORT, 0) {
        Ok(value) => value,
        Err(result) => return result,
    };
    let by = match input_bigint(Some(transition), "by", 1) {
        Ok(value) => value,
        Err(reason) => return invalid(reason),
    };

    match transition.action.as_str() {
        "increment" => {
            if next == current + by {
                valid()
            } else {
                invalid("counter increment mismatch")
            }
        }
        "decrement" => {
            if next == current - by {
                valid()
            } else {
                invalid("counter decrement mismatch")
            }
        }
        "set" => {
            let expected = match input_bigint(Some(transition), "value", current) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if next == expected {
                valid()
            } else {
                invalid("counter set mismatch")
            }
        }
        _ => invalid(format!("unsupported counter action: {}", transition.action)),
    }
}

pub fn build_meter_state_variables(
    previous_state: Option<&SignedChannelState>,
    transition: Option<&ProgramTransition>,
) -> Result<Vec<StateValue>, String> {
    let previous_reading = get_state_bigint(previous_state, METER_READING_PORT, 0)?;
    let previous_unit_price = get_state_bigint(previous_state, METER_UNIT_PRICE_PORT, 0)?;
    let reading = input_bigint(transition, "reading", previous_reading)?;
    let unit_price = input_bigint(transition, "unitPrice", previous_unit_price)?;
    let usage = reading - previous_reading;
    let payment = usage * unit_price;

    Ok(vec![
        program_number_state(METER_READING_PORT, reading)?,
        program_number_state(METER_USAGE_DELTA_PORT, usage)?,
        program_number_state(METER_UNIT_PRICE_PORT, unit_price)?,
        program_number_state(METER_PAYMENT_PORT, payment)?,
    ])
}

pub fn validate_meter_transition(
    channel: &OmniaChannel,
    previous_state: Option<&SignedChannelState>,
    next_state: &SignedChannelState,
    transition: Option<&ProgramTransition>,
) -> ValidationResult {
    let Some(transition) = transition else {
        return valid();
    };
    if transition.action != "record_reading" {
        return invalid(format!("unsupported meter action: {}", transition.action));
    }
    if channel.parties.len() < 2 {
        return invalid("meter program requires payer and payee parties");
    }

    let payer = &channel.parties[0].party_id;
    let payee = &channel.parties[1].party_id;
    let previous_reading = match state_bigint_or_validation(previous_state, METER_READING_PORT, 0) {
        Ok(value) => value,
        Err(result) => return result,
    };
    let reading = match state_bigint_or_validation(Some(next_state), METER_READING_PORT, 0) {
        Ok(value) => value,
        Err(result) => return result,
    };
    if reading < previous_reading {
        return invalid("meter reading decreased");
    }

    let usage = match state_bigint_or_validation(Some(next_state), METER_USAGE_DELTA_PORT, 0) {
        Ok(value) => value,
        Err(result) => return result,
    };
    let unit_price = match state_bigint_or_validation(Some(next_state), METER_UNIT_PRICE_PORT, 0) {
        Ok(value) => value,
        Err(result) => return result,
    };
    let payment = match state_bigint_or_validation(Some(next_state), METER_PAYMENT_PORT, 0) {
        Ok(value) => value,
        Err(result) => return result,
    };
    if usage != reading - previous_reading {
        return invalid("meter usage mismatch");
    }
    if payment != usage * unit_price {
        return invalid("meter payment mismatch");
    }

    let previous_balances = previous_state
        .map(|state| &state.balances)
        .unwrap_or(&channel.balances);
    let previous_payer = match balance_bigint(previous_balances.get(payer), 0) {
        Ok(value) => value,
        Err(result) => return result,
    };
    let previous_payee = match balance_bigint(previous_balances.get(payee), 0) {
        Ok(value) => value,
        Err(result) => return result,
    };
    let next_payer = match balance_bigint(next_state.balances.get(payer), 0) {
        Ok(value) => value,
        Err(result) => return result,
    };
    let next_payee = match balance_bigint(next_state.balances.get(payee), 0) {
        Ok(value) => value,
        Err(result) => return result,
    };

    if next_payer != previous_payer - payment || next_payee != previous_payee + payment {
        return invalid("meter balance transfer mismatch");
    }
    valid()
}

// ─── HTLC payment program ────────────────────────────────────────────────────

fn input_string(transition: Option<&ProgramTransition>, key: &str, fallback: &str) -> String {
    let Some(transition) = transition else {
        return fallback.to_string();
    };
    let Some(inputs) = transition.inputs.as_ref() else {
        return fallback.to_string();
    };
    match inputs.get(key) {
        Some(Value::String(value)) => value.clone(),
        Some(other) => other.to_string(),
        None => fallback.to_string(),
    }
}

pub fn build_htlc_state_variables(
    previous_state: Option<&SignedChannelState>,
    transition: Option<&ProgramTransition>,
) -> Result<Vec<StateValue>, String> {
    let pass_through = || {
        Ok(vec![
            program_hex_state(
                HTLC_HASHLOCK_PORT,
                &get_state_hex(previous_state, HTLC_HASHLOCK_PORT, "")?,
            )?,
            program_number_state(
                HTLC_LOCKED_AMOUNT_PORT,
                get_state_bigint(previous_state, HTLC_LOCKED_AMOUNT_PORT, 0)?,
            )?,
            program_number_state(
                HTLC_TIMEOUT_BLOCK_PORT,
                get_state_bigint(previous_state, HTLC_TIMEOUT_BLOCK_PORT, 0)?,
            )?,
            program_bool_state(
                HTLC_CLAIMED_PORT,
                get_state_bool(previous_state, HTLC_CLAIMED_PORT, false)?,
            )?,
        ])
    };

    let Some(transition) = transition else {
        return pass_through();
    };
    let hashlock = get_state_hex(previous_state, HTLC_HASHLOCK_PORT, "")?;
    let amount = get_state_bigint(previous_state, HTLC_LOCKED_AMOUNT_PORT, 0)?;
    let timeout = get_state_bigint(previous_state, HTLC_TIMEOUT_BLOCK_PORT, 0)?;
    match transition.action.as_str() {
        "add" => {
            let hashlock = normalize_hex(&input_string(Some(transition), "hashlock", ""));
            let amount = input_bigint(Some(transition), "amount", 0)?;
            let timeout = input_bigint(Some(transition), "timeoutBlock", 0)?;
            Ok(vec![
                program_hex_state(HTLC_HASHLOCK_PORT, &hashlock)?,
                program_number_state(HTLC_LOCKED_AMOUNT_PORT, amount)?,
                program_number_state(HTLC_TIMEOUT_BLOCK_PORT, timeout)?,
                program_bool_state(HTLC_CLAIMED_PORT, false)?,
            ])
        }
        "claim" => {
            let preimage = input_string(Some(transition), "preimage", "");
            if preimage.is_empty() || preimage_digest(&preimage) != normalize_hex(&hashlock) {
                return Ok(vec![
                    program_hex_state(HTLC_HASHLOCK_PORT, &hashlock)?,
                    program_number_state(HTLC_LOCKED_AMOUNT_PORT, amount)?,
                    program_number_state(HTLC_TIMEOUT_BLOCK_PORT, timeout)?,
                    program_bool_state(HTLC_CLAIMED_PORT, false)?,
                ]);
            }
            Ok(vec![
                program_hex_state(HTLC_HASHLOCK_PORT, &hashlock)?,
                program_number_state(HTLC_LOCKED_AMOUNT_PORT, 0)?,
                program_number_state(HTLC_TIMEOUT_BLOCK_PORT, timeout)?,
                program_bool_state(HTLC_CLAIMED_PORT, true)?,
            ])
        }
        "timeout" => Ok(vec![
            program_hex_state(HTLC_HASHLOCK_PORT, &hashlock)?,
            program_number_state(HTLC_LOCKED_AMOUNT_PORT, 0)?,
            program_number_state(HTLC_TIMEOUT_BLOCK_PORT, timeout)?,
            program_bool_state(HTLC_CLAIMED_PORT, true)?,
        ]),
        _ => pass_through(),
    }
}

pub fn validate_htlc_transition(
    previous_state: Option<&SignedChannelState>,
    next_state: &SignedChannelState,
    transition: Option<&ProgramTransition>,
) -> ValidationResult {
    let Some(transition) = transition else {
        return valid();
    };
    match transition.action.as_str() {
        "add" => {
            let next_hashlock = match get_state_hex(Some(next_state), HTLC_HASHLOCK_PORT, "") {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let next_amount = match get_state_bigint(Some(next_state), HTLC_LOCKED_AMOUNT_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let expected_amount = match input_bigint(Some(transition), "amount", 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let claimed = match get_state_bool(Some(next_state), HTLC_CLAIMED_PORT, false) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if claimed {
                return invalid("htlc add after claim is not allowed");
            }
            if next_hashlock.is_empty() {
                return invalid("htlc add requires hashlock");
            }
            if next_amount != expected_amount {
                return invalid("htlc amount mismatch");
            }
            valid()
        }
        "claim" => {
            let preimage = input_string(Some(transition), "preimage", "");
            if preimage.is_empty() {
                return invalid("htlc claim requires preimage");
            }
            let lock = match get_state_hex(previous_state, HTLC_HASHLOCK_PORT, "") {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if preimage_digest(&preimage) != normalize_hex(&lock) {
                return invalid("htlc preimage mismatch");
            }
            let next_amount = match get_state_bigint(Some(next_state), HTLC_LOCKED_AMOUNT_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let claimed = match get_state_bool(Some(next_state), HTLC_CLAIMED_PORT, false) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if next_amount != 0 {
                return invalid("htlc claim must release locked amount");
            }
            if !claimed {
                return invalid("htlc claim must set claimed flag");
            }
            valid()
        }
        "timeout" => {
            let current_block = transition
                .inputs
                .as_ref()
                .and_then(|inputs| inputs.get("currentBlock"))
                .and_then(Value::as_str)
                .and_then(|value| value.parse::<i128>().ok())
                .unwrap_or_default();
            let timeout_block = match get_state_bigint(previous_state, HTLC_TIMEOUT_BLOCK_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if current_block < timeout_block {
                return invalid("htlc timeout block not reached");
            }
            let next_amount = match get_state_bigint(Some(next_state), HTLC_LOCKED_AMOUNT_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let claimed = match get_state_bool(Some(next_state), HTLC_CLAIMED_PORT, false) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if next_amount != 0 {
                return invalid("htlc timeout must release locked amount");
            }
            if !claimed {
                return invalid("htlc timeout must set claimed flag");
            }
            valid()
        }
        _ => invalid(format!("unsupported htlc action: {}", transition.action)),
    }
}

// ─── Vault program ───────────────────────────────────────────────────────────

pub fn build_vault_state_variables(
    previous_state: Option<&SignedChannelState>,
    transition: Option<&ProgramTransition>,
) -> Result<Vec<StateValue>, String> {
    let locked = get_state_bigint(previous_state, VAULT_LOCKED_VALUE_PORT, 0)?;
    let release = get_state_bigint(previous_state, VAULT_RELEASE_SEQUENCE_PORT, 0)?;

    let Some(transition) = transition else {
        return Ok(vec![
            program_number_state(VAULT_LOCKED_VALUE_PORT, locked)?,
            program_number_state(VAULT_RELEASE_SEQUENCE_PORT, release)?,
            program_bool_state(
                VAULT_SWEPT_PORT,
                get_state_bool(previous_state, VAULT_SWEPT_PORT, false)?,
            )?,
        ]);
    };
    match transition.action.as_str() {
        "lock" => {
            let amount = input_bigint(Some(transition), "amount", 0)?;
            let release = input_bigint(Some(transition), "releaseSequence", 0)?;
            Ok(vec![
                program_number_state(VAULT_LOCKED_VALUE_PORT, amount)?,
                program_number_state(VAULT_RELEASE_SEQUENCE_PORT, release)?,
                program_bool_state(VAULT_SWEPT_PORT, false)?,
            ])
        }
        "extend" => {
            let release = input_bigint(Some(transition), "releaseSequence", 0)?;
            Ok(vec![
                program_number_state(VAULT_LOCKED_VALUE_PORT, locked)?,
                program_number_state(VAULT_RELEASE_SEQUENCE_PORT, release)?,
                program_bool_state(
                    VAULT_SWEPT_PORT,
                    get_state_bool(previous_state, VAULT_SWEPT_PORT, false)?,
                )?,
            ])
        }
        "release" => Ok(vec![
            program_number_state(VAULT_LOCKED_VALUE_PORT, 0)?,
            program_number_state(VAULT_RELEASE_SEQUENCE_PORT, release)?,
            program_bool_state(VAULT_SWEPT_PORT, true)?,
        ]),
        _ => {
            let swept = get_state_bool(previous_state, VAULT_SWEPT_PORT, false)?;
            Ok(vec![
                program_number_state(VAULT_LOCKED_VALUE_PORT, locked)?,
                program_number_state(VAULT_RELEASE_SEQUENCE_PORT, release)?,
                program_bool_state(VAULT_SWEPT_PORT, swept)?,
            ])
        }
    }
}

pub fn validate_vault_transition(
    previous_state: Option<&SignedChannelState>,
    next_state: &SignedChannelState,
    transition: Option<&ProgramTransition>,
) -> ValidationResult {
    let Some(transition) = transition else {
        return valid();
    };
    match transition.action.as_str() {
        "lock" => {
            let amount = match input_bigint(Some(transition), "amount", 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let release = match input_bigint(Some(transition), "releaseSequence", 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if amount < 0 {
                return invalid("vault lock amount must be non-negative");
            }
            let next_amount = match get_state_bigint(Some(next_state), VAULT_LOCKED_VALUE_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let next_release =
                match get_state_bigint(Some(next_state), VAULT_RELEASE_SEQUENCE_PORT, 0) {
                    Ok(value) => value,
                    Err(reason) => return invalid(reason),
                };
            let swept = match get_state_bool(Some(next_state), VAULT_SWEPT_PORT, false) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if next_amount != amount {
                return invalid("vault locked value mismatch");
            }
            if next_release != release {
                return invalid("vault release sequence mismatch");
            }
            if swept {
                return invalid("vault lock after sweep is not allowed");
            }
            valid()
        }
        "extend" => {
            let release = match input_bigint(Some(transition), "releaseSequence", 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let prev_release =
                match get_state_bigint(previous_state, VAULT_RELEASE_SEQUENCE_PORT, 0) {
                    Ok(value) => value,
                    Err(reason) => return invalid(reason),
                };
            let next_release =
                match get_state_bigint(Some(next_state), VAULT_RELEASE_SEQUENCE_PORT, 0) {
                    Ok(value) => value,
                    Err(reason) => return invalid(reason),
                };
            let swept = match get_state_bool(Some(next_state), VAULT_SWEPT_PORT, false) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if release < prev_release {
                return invalid("vault extend must not shorten release");
            }
            if next_release != release {
                return invalid("vault release sequence mismatch");
            }
            if swept {
                return invalid("vault extend after sweep is not allowed");
            }
            valid()
        }
        "release" => {
            let current_sequence = transition
                .inputs
                .as_ref()
                .and_then(|inputs| inputs.get("sequence"))
                .and_then(Value::as_str)
                .and_then(|value| value.parse::<i128>().ok())
                .unwrap_or_default();
            let prev_release =
                match get_state_bigint(previous_state, VAULT_RELEASE_SEQUENCE_PORT, 0) {
                    Ok(value) => value,
                    Err(reason) => return invalid(reason),
                };
            if current_sequence < prev_release {
                return invalid("vault release sequence not reached");
            }
            let next_amount = match get_state_bigint(Some(next_state), VAULT_LOCKED_VALUE_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let swept = match get_state_bool(Some(next_state), VAULT_SWEPT_PORT, false) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if next_amount != 0 {
                return invalid("vault release must empty locked value");
            }
            if !swept {
                return invalid("vault release must set swept flag");
            }
            valid()
        }
        _ => invalid(format!("unsupported vault action: {}", transition.action)),
    }
}

// ─── Treasury program ────────────────────────────────────────────────────────

pub fn build_treasury_state_variables(
    previous_state: Option<&SignedChannelState>,
    transition: Option<&ProgramTransition>,
) -> Result<Vec<StateValue>, String> {
    let snapshot = get_state_string(previous_state, TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT, "")?;
    let tally = get_state_string(previous_state, TREASURY_VOTE_TALLY_HASH_PORT, "")?;
    let cap = get_state_bigint(previous_state, TREASURY_SPEND_CAP_PORT, 0)?;
    let spent = get_state_bigint(previous_state, TREASURY_SPENT_PORT, 0)?;
    let proof = get_state_string(previous_state, TREASURY_OUTCOME_PROOF_ID_PORT, "")?;

    let pass_through = |spent: i128, snapshot: &str, tally: &str, cap: i128, proof: &str| {
        Ok(vec![
            program_string_state(TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT, snapshot)?,
            program_string_state(TREASURY_VOTE_TALLY_HASH_PORT, tally)?,
            program_number_state(TREASURY_SPEND_CAP_PORT, cap)?,
            program_number_state(TREASURY_SPENT_PORT, spent)?,
            program_string_state(TREASURY_OUTCOME_PROOF_ID_PORT, proof)?,
        ])
    };

    let Some(transition) = transition else {
        return pass_through(spent, &snapshot, &tally, cap, &proof);
    };
    match transition.action.as_str() {
        "configure" | "rotate_snapshot" => {
            let snapshot = input_string(Some(transition), "membershipSnapshotHash", "");
            let tally = input_string(Some(transition), "voteTallyHash", "");
            let cap = input_bigint(Some(transition), "spendCap", 0)?;
            let proof = input_string(Some(transition), "outcomeProofId", "");
            pass_through(0, &snapshot, &tally, cap, &proof)
        }
        "spend" => {
            let amount = input_bigint(Some(transition), "amount", 0)?;
            pass_through(spent + amount, &snapshot, &tally, cap, &proof)
        }
        _ => pass_through(spent, &snapshot, &tally, cap, &proof),
    }
}

pub fn validate_treasury_transition(
    previous_state: Option<&SignedChannelState>,
    next_state: &SignedChannelState,
    transition: Option<&ProgramTransition>,
) -> ValidationResult {
    let Some(transition) = transition else {
        return valid();
    };
    match transition.action.as_str() {
        "configure" => {
            let spend_cap = match get_state_bigint(Some(next_state), TREASURY_SPEND_CAP_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let spent = match get_state_bigint(Some(next_state), TREASURY_SPENT_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if spend_cap < 0 {
                return invalid("treasury spend cap must be non-negative");
            }
            if spent != 0 {
                return invalid("treasury configure must reset spent");
            }
            valid()
        }
        "spend" => {
            let outcome_proof =
                match get_state_string(previous_state, TREASURY_OUTCOME_PROOF_ID_PORT, "") {
                    Ok(value) => value,
                    Err(reason) => return invalid(reason),
                };
            let requested =
                match get_state_string(Some(next_state), TREASURY_OUTCOME_PROOF_ID_PORT, "") {
                    Ok(value) => value,
                    Err(reason) => return invalid(reason),
                };
            if !outcome_proof.is_empty() && requested != outcome_proof {
                return invalid("treasury outcome proof mismatch");
            }
            let cap = match get_state_bigint(previous_state, TREASURY_SPEND_CAP_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let prev_spent = match get_state_bigint(previous_state, TREASURY_SPENT_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let next_spent = match get_state_bigint(Some(next_state), TREASURY_SPENT_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let amount = match input_bigint(Some(transition), "amount", 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if amount < 0 {
                return invalid("treasury spend amount must be non-negative");
            }
            if next_spent != prev_spent + amount {
                return invalid("treasury spent accounting mismatch");
            }
            if next_spent > cap {
                return invalid("treasury spend exceeds cap");
            }
            valid()
        }
        "rotate_snapshot" => {
            let spent = match get_state_bigint(Some(next_state), TREASURY_SPENT_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if spent != 0 {
                return invalid("treasury rotate must reset spent");
            }
            valid()
        }
        _ => invalid(format!(
            "unsupported treasury action: {}",
            transition.action
        )),
    }
}

// ─── Membership program ──────────────────────────────────────────────────────

pub fn build_membership_state_variables(
    previous_state: Option<&SignedChannelState>,
    transition: Option<&ProgramTransition>,
) -> Result<Vec<StateValue>, String> {
    let root = get_state_hex(previous_state, MEMBERSHIP_MEMBER_ROOT_PORT, "")?;
    let pool = get_state_bigint(previous_state, MEMBERSHIP_DIVIDEND_POOL_PORT, 0)?;
    let payout = get_state_bigint(previous_state, MEMBERSHIP_PAYOUT_SEQUENCE_PORT, 0)?;

    let pass_through = || {
        Ok(vec![
            program_hex_state(MEMBERSHIP_MEMBER_ROOT_PORT, &root)?,
            program_number_state(MEMBERSHIP_DIVIDEND_POOL_PORT, pool)?,
            program_number_state(MEMBERSHIP_PAYOUT_SEQUENCE_PORT, payout)?,
        ])
    };

    let Some(transition) = transition else {
        return pass_through();
    };
    match transition.action.as_str() {
        "member_add" | "member_remove" => {
            let root = normalize_hex(&input_string(Some(transition), "memberRoot", ""));
            Ok(vec![
                program_hex_state(MEMBERSHIP_MEMBER_ROOT_PORT, &root)?,
                program_number_state(MEMBERSHIP_DIVIDEND_POOL_PORT, pool)?,
                program_number_state(MEMBERSHIP_PAYOUT_SEQUENCE_PORT, payout)?,
            ])
        }
        "mint_dividend" => {
            let amount = input_bigint(Some(transition), "amount", 0)?;
            Ok(vec![
                program_hex_state(MEMBERSHIP_MEMBER_ROOT_PORT, &root)?,
                program_number_state(MEMBERSHIP_DIVIDEND_POOL_PORT, pool + amount)?,
                program_number_state(MEMBERSHIP_PAYOUT_SEQUENCE_PORT, payout)?,
            ])
        }
        "pay_dividend" => {
            let payout = input_bigint(Some(transition), "payoutSequence", 0)?;
            Ok(vec![
                program_hex_state(MEMBERSHIP_MEMBER_ROOT_PORT, &root)?,
                program_number_state(MEMBERSHIP_DIVIDEND_POOL_PORT, 0)?,
                program_number_state(MEMBERSHIP_PAYOUT_SEQUENCE_PORT, payout)?,
            ])
        }
        _ => pass_through(),
    }
}

pub fn validate_membership_transition(
    previous_state: Option<&SignedChannelState>,
    next_state: &SignedChannelState,
    transition: Option<&ProgramTransition>,
) -> ValidationResult {
    let Some(transition) = transition else {
        return valid();
    };
    match transition.action.as_str() {
        "member_add" | "member_remove" => {
            let root = normalize_hex(&input_string(Some(transition), "memberRoot", ""));
            if root.is_empty() {
                return invalid("membership member root required");
            }
            let next_root = match get_state_hex(Some(next_state), MEMBERSHIP_MEMBER_ROOT_PORT, "") {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if next_root != root {
                return invalid("membership member root mismatch");
            }
            valid()
        }
        "mint_dividend" => {
            let amount = match input_bigint(Some(transition), "amount", 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if amount < 0 {
                return invalid("membership dividend amount must be non-negative");
            }
            let prev_pool = match get_state_bigint(previous_state, MEMBERSHIP_DIVIDEND_POOL_PORT, 0)
            {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let next_pool =
                match get_state_bigint(Some(next_state), MEMBERSHIP_DIVIDEND_POOL_PORT, 0) {
                    Ok(value) => value,
                    Err(reason) => return invalid(reason),
                };
            if next_pool != prev_pool + amount {
                return invalid("membership dividend pool mismatch");
            }
            valid()
        }
        "pay_dividend" => {
            let payout = match input_bigint(Some(transition), "payoutSequence", 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let prev_payout =
                match get_state_bigint(previous_state, MEMBERSHIP_PAYOUT_SEQUENCE_PORT, 0) {
                    Ok(value) => value,
                    Err(reason) => return invalid(reason),
                };
            let next_payout =
                match get_state_bigint(Some(next_state), MEMBERSHIP_PAYOUT_SEQUENCE_PORT, 0) {
                    Ok(value) => value,
                    Err(reason) => return invalid(reason),
                };
            let next_pool =
                match get_state_bigint(Some(next_state), MEMBERSHIP_DIVIDEND_POOL_PORT, 0) {
                    Ok(value) => value,
                    Err(reason) => return invalid(reason),
                };
            if payout <= prev_payout {
                return invalid("membership payout must advance sequence");
            }
            if next_payout != payout {
                return invalid("membership payout sequence mismatch");
            }
            if next_pool != 0 {
                return invalid("membership payout must empty pool");
            }
            valid()
        }
        _ => invalid(format!(
            "unsupported membership action: {}",
            transition.action
        )),
    }
}

// ─── Asset program ───────────────────────────────────────────────────────────

pub fn build_asset_state_variables(
    previous_state: Option<&SignedChannelState>,
    transition: Option<&ProgramTransition>,
) -> Result<Vec<StateValue>, String> {
    let token = get_state_hex(previous_state, ASSET_TOKEN_ID_PORT, "")?;
    let holder_a = get_state_bigint(previous_state, ASSET_HOLDER_A_BALANCE_PORT, 0)?;
    let holder_b = get_state_bigint(previous_state, ASSET_HOLDER_B_BALANCE_PORT, 0)?;
    let total = get_state_bigint(previous_state, ASSET_TOTAL_PORT, 0)?;

    let pass_through = |token: &str, holder_a: i128, holder_b: i128, total: i128| {
        Ok(vec![
            program_hex_state(ASSET_TOKEN_ID_PORT, token)?,
            program_number_state(ASSET_HOLDER_A_BALANCE_PORT, holder_a)?,
            program_number_state(ASSET_HOLDER_B_BALANCE_PORT, holder_b)?,
            program_number_state(ASSET_TOTAL_PORT, total)?,
        ])
    };

    let Some(transition) = transition else {
        return pass_through(&token, holder_a, holder_b, total);
    };
    match transition.action.as_str() {
        "configure" => {
            let token = normalize_hex(&input_string(Some(transition), "tokenId", ""));
            let holder_a = input_bigint(Some(transition), "holderABalance", 0)?;
            let holder_b = input_bigint(Some(transition), "holderBBalance", 0)?;
            pass_through(&token, holder_a, holder_b, holder_a + holder_b)
        }
        "transfer" => {
            let amount = input_bigint(Some(transition), "amount", 0)?;
            let to = input_string(Some(transition), "to", "b");
            let next_a = if to == "a" {
                holder_a + amount
            } else {
                holder_a - amount
            };
            let next_b = if to == "a" {
                holder_b - amount
            } else {
                holder_b + amount
            };
            pass_through(&token, next_a, next_b, total)
        }
        _ => pass_through(&token, holder_a, holder_b, total),
    }
}

pub fn validate_asset_transition(
    previous_state: Option<&SignedChannelState>,
    next_state: &SignedChannelState,
    transition: Option<&ProgramTransition>,
) -> ValidationResult {
    let Some(transition) = transition else {
        return valid();
    };
    match transition.action.as_str() {
        "configure" => {
            let holder_a = match get_state_bigint(Some(next_state), ASSET_HOLDER_A_BALANCE_PORT, 0)
            {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let holder_b = match get_state_bigint(Some(next_state), ASSET_HOLDER_B_BALANCE_PORT, 0)
            {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let total = match get_state_bigint(Some(next_state), ASSET_TOTAL_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            if holder_a < 0 || holder_b < 0 {
                return invalid("asset balances must be non-negative");
            }
            if total != holder_a + holder_b {
                return invalid("asset conservation mismatch");
            }
            valid()
        }
        "transfer" => {
            let amount = match input_bigint(Some(transition), "amount", 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let to = input_string(Some(transition), "to", "b");
            if amount < 0 {
                return invalid("asset transfer amount must be non-negative");
            }
            let prev_a = match get_state_bigint(previous_state, ASSET_HOLDER_A_BALANCE_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let prev_b = match get_state_bigint(previous_state, ASSET_HOLDER_B_BALANCE_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let total = match get_state_bigint(previous_state, ASSET_TOTAL_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let next_a = match get_state_bigint(Some(next_state), ASSET_HOLDER_A_BALANCE_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let next_b = match get_state_bigint(Some(next_state), ASSET_HOLDER_B_BALANCE_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let next_total = match get_state_bigint(Some(next_state), ASSET_TOTAL_PORT, 0) {
                Ok(value) => value,
                Err(reason) => return invalid(reason),
            };
            let expected_a = if to == "a" {
                prev_a + amount
            } else {
                prev_a - amount
            };
            let expected_b = if to == "b" {
                prev_b + amount
            } else {
                prev_b - amount
            };
            if expected_a < 0 || expected_b < 0 {
                return invalid("asset transfer exceeds balance");
            }
            if next_a != expected_a || next_b != expected_b {
                return invalid("asset balance accounting mismatch");
            }
            if next_total != total {
                return invalid("asset conservation mismatch");
            }
            valid()
        }
        _ => invalid(format!("unsupported asset action: {}", transition.action)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ChannelParticipant, ChannelStatus, SigningIndices};
    use serde_json::json;
    use std::collections::HashMap;

    fn state_with_vars(
        balances: Vec<(&str, &str)>,
        state_variables: Vec<StateValue>,
    ) -> SignedChannelState {
        SignedChannelState {
            sequence: 1,
            balances: balances
                .into_iter()
                .map(|(party, balance)| (party.to_string(), balance.to_string()))
                .collect(),
            pending_htlcs: vec![],
            state_variables,
            transaction_hex: "0xupdate".to_string(),
            signatures: HashMap::new(),
            signing_indices: HashMap::<String, SigningIndices>::new(),
            close_package: None,
            program_transition: None,
        }
    }

    fn channel() -> OmniaChannel {
        OmniaChannel {
            channel_id: "0xchannel".to_string(),
            funding_tx_id: "0xfunding".to_string(),
            funding_coin_id: "0xcoin".to_string(),
            funding_script: "RETURN TRUE".to_string(),
            program_id: METER_PROGRAM_ID.to_string(),
            program_version: 1,
            funding_address: "0xaddress".to_string(),
            token_id: "0x00".to_string(),
            token_scale: 0,
            total_value: "1000".to_string(),
            parties: vec![
                ChannelParticipant {
                    party_id: "alice".to_string(),
                    public_key_digest: "0xaaaa".to_string(),
                    address_index: 0,
                    settlement_address: None,
                    relay_endpoint: None,
                },
                ChannelParticipant {
                    party_id: "bob".to_string(),
                    public_key_digest: "0xbbbb".to_string(),
                    address_index: 1,
                    settlement_address: None,
                    relay_endpoint: None,
                },
            ],
            balances: HashMap::from([
                ("alice".to_string(), "600".to_string()),
                ("bob".to_string(), "400".to_string()),
            ]),
            pending_htlcs: vec![],
            current_sequence: 1,
            latest_state: None,
            state_log: vec![],
            status: ChannelStatus::Active,
            channel_type: "direct".to_string(),
            factory_ref: None,
            pending_proposal: None,
            latest_coin_id: None,
            unilateral_close: None,
            created_at: 1000,
            updated_at: 1000,
        }
    }

    #[test]
    fn default_program_state_is_empty() {
        assert_eq!(ELTOO_PAYMENT_PROGRAM_ID, "eltoo-payment");
        assert!(default_eltoo_payment_state_variables().is_empty());
    }

    #[test]
    fn builds_counter_state_variables() {
        let previous = state_with_vars(
            vec![("alice", "600"), ("bob", "400")],
            vec![program_number_state(COUNTER_STATE_PORT, 10).unwrap()],
        );

        let increment = ProgramTransition {
            action: "increment".to_string(),
            inputs: Some(json!({ "by": "5" })),
            witness: None,
            metadata: None,
        };
        let vars = build_counter_state_variables(Some(&previous), Some(&increment)).unwrap();
        assert_eq!(vars[0].value, json!("15"));
        assert_eq!(vars[1].value, json!(COUNTER_ACTION_INCREMENT.to_string()));
        assert_eq!(vars[2].value, json!("5"));

        let set = ProgramTransition {
            action: "set".to_string(),
            inputs: Some(json!({ "value": "42" })),
            witness: None,
            metadata: None,
        };
        let vars = build_counter_state_variables(Some(&previous), Some(&set)).unwrap();
        assert_eq!(vars[0].value, json!("42"));
        assert_eq!(vars[1].value, json!(COUNTER_ACTION_SET.to_string()));
        assert_eq!(vars[2].value, json!("42"));

        let unknown = ProgramTransition {
            action: "noop".to_string(),
            inputs: None,
            witness: None,
            metadata: None,
        };
        let vars = build_counter_state_variables(Some(&previous), Some(&unknown)).unwrap();
        assert_eq!(vars[0].value, json!("10"));
        assert_eq!(vars[1].value, json!(COUNTER_ACTION_NONE.to_string()));
        assert_eq!(vars[2].value, json!("0"));
    }

    #[test]
    fn validates_counter_transition() {
        let previous = state_with_vars(
            vec![("alice", "600"), ("bob", "400")],
            vec![program_number_state(COUNTER_STATE_PORT, 10).unwrap()],
        );
        let next = state_with_vars(
            vec![("alice", "600"), ("bob", "400")],
            vec![program_number_state(COUNTER_STATE_PORT, 15).unwrap()],
        );
        let transition = ProgramTransition {
            action: "increment".to_string(),
            inputs: Some(json!({ "by": "5" })),
            witness: None,
            metadata: None,
        };
        assert!(validate_counter_transition(Some(&previous), &next, Some(&transition)).valid);

        let tampered = state_with_vars(
            vec![("alice", "600"), ("bob", "400")],
            vec![program_number_state(COUNTER_STATE_PORT, 14).unwrap()],
        );
        let result = validate_counter_transition(Some(&previous), &tampered, Some(&transition));
        assert!(!result.valid);
        assert_eq!(result.reason.as_deref(), Some("counter increment mismatch"));
    }

    #[test]
    fn builds_meter_state_variables() {
        let previous = state_with_vars(
            vec![("alice", "600"), ("bob", "400")],
            vec![
                program_number_state(METER_READING_PORT, 100).unwrap(),
                program_number_state(METER_UNIT_PRICE_PORT, 2).unwrap(),
            ],
        );
        let transition = ProgramTransition {
            action: "record_reading".to_string(),
            inputs: Some(json!({ "reading": "110", "unitPrice": "2" })),
            witness: None,
            metadata: None,
        };

        let vars = build_meter_state_variables(Some(&previous), Some(&transition)).unwrap();
        assert_eq!(vars[0].value, json!("110"));
        assert_eq!(vars[1].value, json!("10"));
        assert_eq!(vars[2].value, json!("2"));
        assert_eq!(vars[3].value, json!("20"));
    }

    #[test]
    fn validates_meter_transition() {
        let previous = state_with_vars(
            vec![("alice", "600"), ("bob", "400")],
            vec![program_number_state(METER_READING_PORT, 100).unwrap()],
        );
        let next = state_with_vars(
            vec![("alice", "580"), ("bob", "420")],
            vec![
                program_number_state(METER_READING_PORT, 110).unwrap(),
                program_number_state(METER_USAGE_DELTA_PORT, 10).unwrap(),
                program_number_state(METER_UNIT_PRICE_PORT, 2).unwrap(),
                program_number_state(METER_PAYMENT_PORT, 20).unwrap(),
            ],
        );
        let transition = ProgramTransition {
            action: "record_reading".to_string(),
            inputs: Some(json!({ "reading": "110", "unitPrice": "2" })),
            witness: None,
            metadata: None,
        };

        assert!(
            validate_meter_transition(&channel(), Some(&previous), &next, Some(&transition)).valid
        );

        let tampered = state_with_vars(
            vec![("alice", "579"), ("bob", "421")],
            next.state_variables.clone(),
        );
        let result =
            validate_meter_transition(&channel(), Some(&previous), &tampered, Some(&transition));
        assert!(!result.valid);
        assert_eq!(
            result.reason.as_deref(),
            Some("meter balance transfer mismatch")
        );
    }

    #[test]
    fn builds_and_validates_htlc_state_variables() {
        let previous = state_with_vars(
            vec![],
            vec![
                program_hex_state(HTLC_HASHLOCK_PORT, "0xabcdef").unwrap(),
                program_number_state(HTLC_LOCKED_AMOUNT_PORT, 500).unwrap(),
                program_number_state(HTLC_TIMEOUT_BLOCK_PORT, 100).unwrap(),
                program_bool_state(HTLC_CLAIMED_PORT, false).unwrap(),
            ],
        );

        let add = ProgramTransition {
            action: "add".to_string(),
            inputs: Some(json!({ "hashlock": "0x0123", "amount": "250", "timeoutBlock": "200" })),
            witness: None,
            metadata: None,
        };
        let vars = build_htlc_state_variables(Some(&previous), Some(&add)).unwrap();
        assert_eq!(vars[0].value, json!("0123"));
        assert_eq!(vars[1].value, json!("250"));
        assert_eq!(vars[2].value, json!("200"));
        assert_eq!(vars[3].value, json!(false));

        let preimage = "secret";
        let digest = preimage_digest(preimage);
        let claimed_prev = state_with_vars(
            vec![],
            vec![
                program_hex_state(HTLC_HASHLOCK_PORT, &digest).unwrap(),
                program_number_state(HTLC_LOCKED_AMOUNT_PORT, 500).unwrap(),
                program_number_state(HTLC_TIMEOUT_BLOCK_PORT, 100).unwrap(),
                program_bool_state(HTLC_CLAIMED_PORT, false).unwrap(),
            ],
        );
        let claim = ProgramTransition {
            action: "claim".to_string(),
            inputs: Some(json!({ "preimage": preimage })),
            witness: None,
            metadata: None,
        };
        let claimed = state_with_vars(
            vec![],
            vec![
                program_hex_state(HTLC_HASHLOCK_PORT, &digest).unwrap(),
                program_number_state(HTLC_LOCKED_AMOUNT_PORT, 0).unwrap(),
                program_number_state(HTLC_TIMEOUT_BLOCK_PORT, 100).unwrap(),
                program_bool_state(HTLC_CLAIMED_PORT, true).unwrap(),
            ],
        );
        assert!(validate_htlc_transition(Some(&claimed_prev), &claimed, Some(&claim)).valid);

        let timeout = ProgramTransition {
            action: "timeout".to_string(),
            inputs: Some(json!({ "currentBlock": "200" })),
            witness: None,
            metadata: None,
        };
        assert!(validate_htlc_transition(Some(&previous), &claimed.clone(), Some(&timeout)).valid);
    }

    #[test]
    fn builds_and_validates_vault_state_variables() {
        let lock = ProgramTransition {
            action: "lock".to_string(),
            inputs: Some(json!({ "amount": "800", "releaseSequence": "50" })),
            witness: None,
            metadata: None,
        };
        let vars = build_vault_state_variables(None, Some(&lock)).unwrap();
        assert_eq!(vars[0].value, json!("800"));
        assert_eq!(vars[1].value, json!("50"));
        assert_eq!(vars[2].value, json!(false));

        let next = state_with_vars(
            vec![],
            vec![
                program_number_state(VAULT_LOCKED_VALUE_PORT, 800).unwrap(),
                program_number_state(VAULT_RELEASE_SEQUENCE_PORT, 50).unwrap(),
                program_bool_state(VAULT_SWEPT_PORT, false).unwrap(),
            ],
        );
        assert!(validate_vault_transition(None, &next, Some(&lock)).valid);

        let release_early = ProgramTransition {
            action: "release".to_string(),
            inputs: Some(json!({ "sequence": "10" })),
            witness: None,
            metadata: None,
        };
        let result = validate_vault_transition(Some(&next), &next.clone(), Some(&release_early));
        assert!(!result.valid);
        assert_eq!(
            result.reason.as_deref(),
            Some("vault release sequence not reached")
        );
    }

    #[test]
    fn builds_and_validates_treasury_state_variables() {
        let configure = ProgramTransition {
            action: "configure".to_string(),
            inputs: Some(json!({
                "membershipSnapshotHash": "snap-1",
                "voteTallyHash": "tally-1",
                "spendCap": "1000",
                "outcomeProofId": "proof-1"
            })),
            witness: None,
            metadata: None,
        };
        let vars = build_treasury_state_variables(None, Some(&configure)).unwrap();
        assert_eq!(vars[0].value, json!("snap-1"));
        assert_eq!(vars[2].value, json!("1000"));
        assert_eq!(vars[3].value, json!("0"));

        let next = state_with_vars(
            vec![],
            vec![
                program_string_state(TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT, "snap-1").unwrap(),
                program_string_state(TREASURY_VOTE_TALLY_HASH_PORT, "tally-1").unwrap(),
                program_number_state(TREASURY_SPEND_CAP_PORT, 1000).unwrap(),
                program_number_state(TREASURY_SPENT_PORT, 0).unwrap(),
                program_string_state(TREASURY_OUTCOME_PROOF_ID_PORT, "proof-1").unwrap(),
            ],
        );
        assert!(validate_treasury_transition(None, &next, Some(&configure)).valid);

        let spend = ProgramTransition {
            action: "spend".to_string(),
            inputs: Some(json!({ "amount": "250" })),
            witness: None,
            metadata: None,
        };
        let spent = state_with_vars(
            vec![],
            vec![
                program_string_state(TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT, "snap-1").unwrap(),
                program_string_state(TREASURY_VOTE_TALLY_HASH_PORT, "tally-1").unwrap(),
                program_number_state(TREASURY_SPEND_CAP_PORT, 1000).unwrap(),
                program_number_state(TREASURY_SPENT_PORT, 250).unwrap(),
                program_string_state(TREASURY_OUTCOME_PROOF_ID_PORT, "proof-1").unwrap(),
            ],
        );
        assert!(validate_treasury_transition(Some(&next), &spent, Some(&spend)).valid);

        let overspend = ProgramTransition {
            action: "spend".to_string(),
            inputs: Some(json!({ "amount": "2000" })),
            witness: None,
            metadata: None,
        };
        let result = validate_treasury_transition(Some(&next), &next.clone(), Some(&overspend));
        assert!(!result.valid);
        assert_eq!(
            result.reason.as_deref(),
            Some("treasury spent accounting mismatch")
        );
    }

    #[test]
    fn builds_and_validates_membership_state_variables() {
        let add = ProgramTransition {
            action: "member_add".to_string(),
            inputs: Some(json!({ "memberRoot": "0xABCD" })),
            witness: None,
            metadata: None,
        };
        let vars = build_membership_state_variables(None, Some(&add)).unwrap();
        assert_eq!(vars[0].value, json!("abcd"));
        assert_eq!(vars[1].value, json!("0"));

        let next = state_with_vars(
            vec![],
            vec![
                program_hex_state(MEMBERSHIP_MEMBER_ROOT_PORT, "abcd").unwrap(),
                program_number_state(MEMBERSHIP_DIVIDEND_POOL_PORT, 0).unwrap(),
                program_number_state(MEMBERSHIP_PAYOUT_SEQUENCE_PORT, 0).unwrap(),
            ],
        );
        assert!(validate_membership_transition(None, &next, Some(&add)).valid);

        let mint = ProgramTransition {
            action: "mint_dividend".to_string(),
            inputs: Some(json!({ "amount": "100" })),
            witness: None,
            metadata: None,
        };
        let pooled = state_with_vars(
            vec![],
            vec![
                program_hex_state(MEMBERSHIP_MEMBER_ROOT_PORT, "abcd").unwrap(),
                program_number_state(MEMBERSHIP_DIVIDEND_POOL_PORT, 100).unwrap(),
                program_number_state(MEMBERSHIP_PAYOUT_SEQUENCE_PORT, 0).unwrap(),
            ],
        );
        assert!(validate_membership_transition(Some(&next), &pooled, Some(&mint)).valid);

        let pay = ProgramTransition {
            action: "pay_dividend".to_string(),
            inputs: Some(json!({ "payoutSequence": "1" })),
            witness: None,
            metadata: None,
        };
        let paid = state_with_vars(
            vec![],
            vec![
                program_hex_state(MEMBERSHIP_MEMBER_ROOT_PORT, "abcd").unwrap(),
                program_number_state(MEMBERSHIP_DIVIDEND_POOL_PORT, 0).unwrap(),
                program_number_state(MEMBERSHIP_PAYOUT_SEQUENCE_PORT, 1).unwrap(),
            ],
        );
        assert!(validate_membership_transition(Some(&pooled), &paid, Some(&pay)).valid);
    }

    #[test]
    fn builds_and_validates_asset_state_variables() {
        let configure = ProgramTransition {
            action: "configure".to_string(),
            inputs: Some(
                json!({ "tokenId": "0xABCD", "holderABalance": "300", "holderBBalance": "200" }),
            ),
            witness: None,
            metadata: None,
        };
        let vars = build_asset_state_variables(None, Some(&configure)).unwrap();
        assert_eq!(vars[0].value, json!("abcd"));
        assert_eq!(vars[1].value, json!("300"));
        assert_eq!(vars[2].value, json!("200"));
        assert_eq!(vars[3].value, json!("500"));

        let next = state_with_vars(
            vec![],
            vec![
                program_hex_state(ASSET_TOKEN_ID_PORT, "abcd").unwrap(),
                program_number_state(ASSET_HOLDER_A_BALANCE_PORT, 300).unwrap(),
                program_number_state(ASSET_HOLDER_B_BALANCE_PORT, 200).unwrap(),
                program_number_state(ASSET_TOTAL_PORT, 500).unwrap(),
            ],
        );
        assert!(validate_asset_transition(None, &next, Some(&configure)).valid);

        let transfer = ProgramTransition {
            action: "transfer".to_string(),
            inputs: Some(json!({ "amount": "100", "to": "b" })),
            witness: None,
            metadata: None,
        };
        let transferred = state_with_vars(
            vec![],
            vec![
                program_hex_state(ASSET_TOKEN_ID_PORT, "abcd").unwrap(),
                program_number_state(ASSET_HOLDER_A_BALANCE_PORT, 200).unwrap(),
                program_number_state(ASSET_HOLDER_B_BALANCE_PORT, 300).unwrap(),
                program_number_state(ASSET_TOTAL_PORT, 500).unwrap(),
            ],
        );
        assert!(validate_asset_transition(Some(&next), &transferred, Some(&transfer)).valid);

        let overspend = ProgramTransition {
            action: "transfer".to_string(),
            inputs: Some(json!({ "amount": "500", "to": "b" })),
            witness: None,
            metadata: None,
        };
        let result = validate_asset_transition(Some(&next), &next.clone(), Some(&overspend));
        assert!(!result.valid);
        assert_eq!(
            result.reason.as_deref(),
            Some("asset transfer exceeds balance")
        );
    }
}
