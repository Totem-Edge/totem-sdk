use serde_json::{json, Value};

use crate::types::{SignedChannelState, StateValue};

pub const PROGRAM_STATE_PORT_MIN: u32 = 120;

pub fn assert_program_state_port(port: u32) -> Result<(), String> {
    if port < PROGRAM_STATE_PORT_MIN {
        return Err(format!(
            "Program state port must be an integer >= {}",
            PROGRAM_STATE_PORT_MIN
        ));
    }
    Ok(())
}

pub fn get_state_value(state: Option<&SignedChannelState>, port: u32) -> Option<&StateValue> {
    state?
        .state_variables
        .iter()
        .find(|value| value.port == port)
}

pub fn get_state_bigint(
    state: Option<&SignedChannelState>,
    port: u32,
    fallback: i128,
) -> Result<i128, String> {
    let Some(value) = get_state_value(state, port) else {
        return Ok(fallback);
    };

    match &value.value {
        Value::String(value) => value.parse::<i128>().map_err(|e| e.to_string()),
        Value::Number(value) => value
            .as_i64()
            .map(i128::from)
            .ok_or_else(|| format!("Invalid integer state value at port {}", port)),
        other => Err(format!(
            "Invalid integer state value at port {}: {}",
            port, other
        )),
    }
}

pub fn program_number_state(port: u32, value: i128) -> Result<StateValue, String> {
    assert_program_state_port(port)?;
    Ok(StateValue {
        port,
        value: json!(value.to_string()),
        value_type: "number".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn validates_program_state_ports() {
        assert!(assert_program_state_port(119).is_err());
        assert!(assert_program_state_port(120).is_ok());
    }

    #[test]
    fn builds_and_reads_program_number_state() {
        let state_value = program_number_state(120, 42).unwrap();
        assert_eq!(state_value.port, 120);
        assert_eq!(state_value.value, json!("42"));
        assert_eq!(state_value.value_type, "number");

        let signed = SignedChannelState {
            sequence: 1,
            balances: HashMap::new(),
            pending_htlcs: vec![],
            state_variables: vec![state_value],
            transaction_hex: "0xupdate".to_string(),
            signatures: HashMap::new(),
            signing_indices: HashMap::new(),
            close_package: None,
            program_transition: None,
        };

        assert_eq!(get_state_bigint(Some(&signed), 120, 0).unwrap(), 42);
        assert_eq!(get_state_bigint(Some(&signed), 121, 7).unwrap(), 7);
    }

    #[test]
    fn rejects_non_integer_state_values() {
        let signed = SignedChannelState {
            sequence: 1,
            balances: HashMap::new(),
            pending_htlcs: vec![],
            state_variables: vec![StateValue {
                port: 120,
                value: json!(true),
                value_type: "bool".to_string(),
            }],
            transaction_hex: "0xupdate".to_string(),
            signatures: HashMap::new(),
            signing_indices: HashMap::new(),
            close_package: None,
            program_transition: None,
        };

        assert!(get_state_bigint(Some(&signed), 120, 0).is_err());
    }
}
