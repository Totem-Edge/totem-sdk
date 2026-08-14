use serde_json::{json, Value};

use crate::types::{SignedChannelState, StateValue};

pub const PROGRAM_STATE_PORT_MIN: u32 = 120;

pub fn normalize_hex(value: &str) -> String {
    value
        .strip_prefix("0x")
        .unwrap_or(value)
        .to_ascii_lowercase()
}

pub fn preimage_digest(preimage: &str) -> String {
    use sha3::{Digest, Sha3_256};
    let mut hasher = Sha3_256::new();
    hasher.update(preimage.as_bytes());
    hex::encode(hasher.finalize())
}

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

pub fn program_bool_state(port: u32, value: bool) -> Result<StateValue, String> {
    assert_program_state_port(port)?;
    Ok(StateValue {
        port,
        value: json!(value),
        value_type: "bool".to_string(),
    })
}

pub fn program_hex_state(port: u32, value: &str) -> Result<StateValue, String> {
    assert_program_state_port(port)?;
    let hex = value.strip_prefix("0x").unwrap_or(value);
    if !hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(format!(
            "Program state port {}: hex value must be a hex string",
            port
        ));
    }
    Ok(StateValue {
        port,
        value: json!(value.to_string()),
        value_type: "hex".to_string(),
    })
}

pub fn program_string_state(port: u32, value: &str) -> Result<StateValue, String> {
    assert_program_state_port(port)?;
    Ok(StateValue {
        port,
        value: json!(value.to_string()),
        value_type: "string".to_string(),
    })
}

pub fn get_state_hex(
    state: Option<&SignedChannelState>,
    port: u32,
    fallback: &str,
) -> Result<String, String> {
    let Some(value) = get_state_value(state, port) else {
        return Ok(fallback.to_string());
    };

    match &value.value {
        Value::String(value) => Ok(value.clone()),
        other => Err(format!(
            "Invalid hex state value at port {}: {}",
            port, other
        )),
    }
}

pub fn get_state_string(
    state: Option<&SignedChannelState>,
    port: u32,
    fallback: &str,
) -> Result<String, String> {
    get_state_hex(state, port, fallback)
}

pub fn get_state_bool(
    state: Option<&SignedChannelState>,
    port: u32,
    fallback: bool,
) -> Result<bool, String> {
    let Some(value) = get_state_value(state, port) else {
        return Ok(fallback);
    };

    match &value.value {
        Value::Bool(value) => Ok(*value),
        other => Err(format!(
            "Invalid bool state value at port {}: {}",
            port, other
        )),
    }
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

    #[test]
    fn builds_and_reads_hex_bool_string_state() {
        let hex = program_hex_state(140, "0xdeadbeef").unwrap();
        assert_eq!(hex.value_type, "hex");
        assert_eq!(hex.value, json!("0xdeadbeef"));
        assert!(program_hex_state(140, "not-hex!").is_err());

        let bool_state = program_bool_state(143, true).unwrap();
        assert_eq!(bool_state.value_type, "bool");
        assert_eq!(bool_state.value, json!(true));

        let string_state = program_string_state(160, "snapshot-root").unwrap();
        assert_eq!(string_state.value_type, "string");
        assert_eq!(string_state.value, json!("snapshot-root"));
    }

    #[test]
    fn reads_string_state_and_preimage_digest() {
        let signed = SignedChannelState {
            sequence: 1,
            balances: HashMap::new(),
            pending_htlcs: vec![],
            state_variables: vec![program_string_state(160, "snapshot-root").unwrap()],
            transaction_hex: "0xupdate".to_string(),
            signatures: HashMap::new(),
            signing_indices: HashMap::new(),
            close_package: None,
            program_transition: None,
        };

        assert_eq!(
            get_state_string(Some(&signed), 160, "").unwrap(),
            "snapshot-root"
        );
        assert_eq!(
            get_state_string(Some(&signed), 161, "fallback").unwrap(),
            "fallback"
        );

        assert_eq!(normalize_hex("0xABCDEF"), "abcdef");
        assert_eq!(normalize_hex("ABCDEF"), "abcdef");

        let digest = preimage_digest("totem");
        assert_eq!(digest.len(), 64);
        assert!(digest.chars().all(|c| c.is_ascii_hexdigit()));
        assert!(digest == digest.to_ascii_lowercase());
    }
}
