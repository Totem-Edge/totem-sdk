use serde_json::{Map, Value};

use crate::types::ProgramTransition;

fn canonical_scalar(value: &Value, path: &str) -> Result<Value, String> {
    match value {
        Value::String(_) | Value::Bool(_) => Ok(value.clone()),
        _ => Err(format!(
            "Invalid ProgramTransition {}: expected string, bigint, or boolean",
            path
        )),
    }
}

fn canonical_record(record: Option<&Value>, path: &str) -> Result<Option<Value>, String> {
    let Some(record) = record else {
        return Ok(None);
    };
    let Value::Object(obj) = record else {
        return Err(format!(
            "Invalid ProgramTransition {}: expected object",
            path
        ));
    };
    if obj.is_empty() {
        return Ok(None);
    }

    let mut out = Map::new();
    let mut keys: Vec<&String> = obj.keys().collect();
    keys.sort();
    for key in keys {
        out.insert(
            key.clone(),
            canonical_scalar(&obj[key], &format!("{}.{}", path, key))?,
        );
    }
    Ok(Some(Value::Object(out)))
}

fn canonical_string_record(record: Option<&Value>, path: &str) -> Result<Option<Value>, String> {
    let Some(record) = record else {
        return Ok(None);
    };
    let Value::Object(obj) = record else {
        return Err(format!(
            "Invalid ProgramTransition {}: expected object",
            path
        ));
    };
    if obj.is_empty() {
        return Ok(None);
    }

    let mut out = Map::new();
    let mut keys: Vec<&String> = obj.keys().collect();
    keys.sort();
    for key in keys {
        match &obj[key] {
            Value::String(value) => {
                out.insert(key.clone(), Value::String(value.clone()));
            }
            _ => {
                return Err(format!(
                    "Invalid ProgramTransition {}.{}: expected string",
                    path, key
                ));
            }
        }
    }
    Ok(Some(Value::Object(out)))
}

pub fn canonicalize_program_transition(
    transition: Option<&ProgramTransition>,
) -> Result<Option<ProgramTransition>, String> {
    let Some(transition) = transition else {
        return Ok(None);
    };
    if transition.action.is_empty() {
        return Err("Invalid ProgramTransition action: expected non-empty string".to_string());
    }

    Ok(Some(ProgramTransition {
        action: transition.action.clone(),
        inputs: canonical_record(transition.inputs.as_ref(), "inputs")?,
        witness: canonical_string_record(transition.witness.as_ref(), "witness")?,
        metadata: canonical_string_record(transition.metadata.as_ref(), "metadata")?,
    }))
}

pub fn validate_program_transition_shape(transition: &ProgramTransition) -> Result<(), String> {
    canonicalize_program_transition(Some(transition)).map(|_| ())
}

fn canonical_json_value(value: &Value) -> String {
    match value {
        Value::Array(values) => format!(
            "[{}]",
            values
                .iter()
                .map(canonical_json_value)
                .collect::<Vec<_>>()
                .join(",")
        ),
        Value::Object(obj) => {
            let mut keys: Vec<&String> = obj.keys().collect();
            keys.sort();
            let body = keys
                .iter()
                .map(|key| {
                    format!(
                        "{}:{}",
                        serde_json::to_string(key).unwrap_or_default(),
                        canonical_json_value(&obj[*key])
                    )
                })
                .collect::<Vec<_>>()
                .join(",");
            format!("{{{}}}", body)
        }
        _ => serde_json::to_string(value).unwrap_or_default(),
    }
}

pub fn serialize_program_transition(transition: &ProgramTransition) -> Result<String, String> {
    let canonical = canonicalize_program_transition(Some(transition))?
        .ok_or_else(|| "Invalid ProgramTransition: expected object".to_string())?;
    let value = serde_json::to_value(canonical).map_err(|e| e.to_string())?;
    Ok(canonical_json_value(&value))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn serializes_transition_with_sorted_fields_and_records() {
        let transition = ProgramTransition {
            action: "set".to_string(),
            inputs: Some(json!({ "value": "42", "enabled": true })),
            witness: Some(json!({ "source": "sensor", "proof": "0xabc" })),
            metadata: Some(json!({ "requestId": "req-1" })),
        };

        assert_eq!(
            serialize_program_transition(&transition).unwrap(),
            "{\"action\":\"set\",\"inputs\":{\"enabled\":true,\"value\":\"42\"},\"metadata\":{\"requestId\":\"req-1\"},\"witness\":{\"proof\":\"0xabc\",\"source\":\"sensor\"}}"
        );
    }

    #[test]
    fn omits_empty_optional_records() {
        let transition = ProgramTransition {
            action: "increment".to_string(),
            inputs: Some(json!({})),
            witness: None,
            metadata: Some(json!({})),
        };

        assert_eq!(
            serialize_program_transition(&transition).unwrap(),
            "{\"action\":\"increment\"}"
        );
    }

    #[test]
    fn rejects_invalid_transition_shapes() {
        let empty_action = ProgramTransition {
            action: "".to_string(),
            inputs: None,
            witness: None,
            metadata: None,
        };
        assert_eq!(
            serialize_program_transition(&empty_action).unwrap_err(),
            "Invalid ProgramTransition action: expected non-empty string"
        );

        let numeric_input = ProgramTransition {
            action: "set".to_string(),
            inputs: Some(json!({ "value": 42 })),
            witness: None,
            metadata: None,
        };
        assert_eq!(
            serialize_program_transition(&numeric_input).unwrap_err(),
            "Invalid ProgramTransition inputs.value: expected string, bigint, or boolean"
        );

        let non_string_witness = ProgramTransition {
            action: "set".to_string(),
            inputs: None,
            witness: Some(json!({ "proof": true })),
            metadata: None,
        };
        assert_eq!(
            serialize_program_transition(&non_string_witness).unwrap_err(),
            "Invalid ProgramTransition witness.proof: expected string"
        );
    }
}
