use serde_json::Value;

use crate::state_vars::{get_state_bigint, program_number_state};
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
}
