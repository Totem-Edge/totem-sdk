//! Canonical Minima transaction serialisation and digests.
//!
//! Byte-for-byte port of the TypeScript `omniaDraftToCanonicalMinimaBytes` /
//! `computeOmniaTxDigest`. The signed payload is the SHA3-256 of these bytes, so
//! any divergence here would silently invalidate (or forge) channel signatures.

use serde::Deserialize;
use serde_json::Value;
use sha3::{Digest, Sha3_256};

use crate::types::StateValue;

const COINID_OUTPUT: &str = "0x00";
const COINID_ELTOO: &str = "0x01";

#[derive(Debug, Clone, Deserialize)]
pub struct DraftCoin {
    #[serde(rename = "coinId", default)]
    pub coin_id: Option<String>,
    pub address: String,
    pub amount: Value,
    #[serde(rename = "tokenId")]
    pub token_id: String,
    #[serde(rename = "storeState")]
    pub store_state: Option<bool>,
    #[serde(rename = "stateVariables")]
    pub state_variables: Option<Vec<StateValue>>,
    #[serde(rename = "scriptHex")]
    pub script_hex: Option<String>,
    #[serde(rename = "mmrEntry")]
    pub mmr_entry: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TxDraft {
    #[serde(rename = "type")]
    pub tx_type: String,
    pub inputs: Vec<DraftCoin>,
    pub outputs: Vec<DraftCoin>,
    #[serde(rename = "stateVariables")]
    pub state_variables: Vec<StateValue>,
    #[serde(rename = "storeState")]
    pub store_state: Option<bool>,
}

pub fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, String> {
    let raw = hex
        .strip_prefix("0x")
        .or_else(|| hex.strip_prefix("0X"))
        .unwrap_or(hex);
    if raw.is_empty() {
        return Ok(Vec::new());
    }
    if raw.len() % 2 != 0 {
        return Err(format!("Invalid hex string: odd length ({})", raw.len()));
    }
    hex::decode(raw).map_err(|_| format!("Invalid hex string: {hex}"))
}

pub fn bytes_to_hex(bytes: &[u8]) -> String {
    format!("0x{}", hex::encode(bytes))
}

pub fn normalize_hex(value: &str) -> String {
    value
        .strip_prefix("0x")
        .or_else(|| value.strip_prefix("0X"))
        .unwrap_or(value)
        .to_lowercase()
}

/// Parse a draft amount: either a plain JSON number, a decimal string, or the
/// `__bigint__` marker produced by the SDK's `bigintReplacer`.
pub fn parse_amount(value: &Value) -> Result<u128, String> {
    match value {
        Value::String(text) => {
            let raw = text.strip_prefix("__bigint__").unwrap_or(text);
            raw.parse::<u128>()
                .map_err(|_| format!("Invalid amount: {text:?}"))
        }
        Value::Number(number) => number
            .as_u64()
            .map(u128::from)
            .ok_or_else(|| format!("Invalid amount: {number}")),
        other => Err(format!("Invalid amount: {other}")),
    }
}

fn value_as_string(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Bool(flag) => flag.to_string(),
        Value::Null => "null".to_string(),
        other => other.to_string(),
    }
}

fn java_bytes(value: u128) -> Vec<u8> {
    if value == 0 {
        return vec![0];
    }
    let be = value.to_be_bytes();
    let first = be.iter().position(|byte| *byte != 0).unwrap_or(be.len() - 1);
    let mut bytes = be[first..].to_vec();
    if bytes[0] & 0x80 != 0 {
        bytes.insert(0, 0);
    }
    bytes
}

fn write_mini_number(value: u128) -> Result<Vec<u8>, String> {
    let unscaled = java_bytes(value);
    if unscaled.len() > 255 {
        return Err(format!("MiniNumber data too large: {}", unscaled.len()));
    }
    let mut out = Vec::with_capacity(2 + unscaled.len());
    out.push(0);
    out.push(unscaled.len() as u8);
    out.extend_from_slice(&unscaled);
    Ok(out)
}

fn write_mini_data(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(4 + data.len());
    out.extend_from_slice(&(data.len() as u32).to_be_bytes());
    out.extend_from_slice(data);
    out
}

fn write_hash(hex: &str) -> Result<Vec<u8>, String> {
    Ok(write_mini_data(&hex_to_bytes(hex)?))
}

fn write_mmr_entry(value: u128) -> Result<Vec<u8>, String> {
    let mut out = write_mini_number(0)?;
    out.extend_from_slice(&write_mini_data(&java_bytes(value)));
    Ok(out)
}

fn write_state_value(value: &StateValue) -> Result<Vec<u8>, String> {
    if value.port > 255 {
        return Err(format!("State port out of range: {}", value.port));
    }
    let mut out = vec![value.port as u8];
    match value.value_type.as_str() {
        "bool" => {
            let truthy = match &value.value {
                Value::Bool(flag) => *flag,
                Value::String(text) => text.eq_ignore_ascii_case("true"),
                Value::Number(number) => number.as_u64().unwrap_or(0) != 0,
                _ => false,
            };
            out.push(8);
            out.push(u8::from(truthy));
        }
        "number" => {
            out.push(2);
            out.extend_from_slice(&write_mini_number(parse_amount(&value.value)?)?);
        }
        "hex" => {
            out.push(1);
            out.extend_from_slice(&write_mini_data(&hex_to_bytes(&value_as_string(&value.value))?));
        }
        "string" => {
            out.push(4);
            let raw = value_as_string(&value.value);
            let bracketed = if raw.starts_with('[') && raw.ends_with(']') {
                raw
            } else {
                format!("[{raw}]")
            };
            out.extend_from_slice(&write_mini_data(bracketed.as_bytes()));
        }
        other => return Err(format!("Unknown StateValue type: {other}")),
    }
    Ok(out)
}

fn serialize_coin(
    coin_id: &str,
    address: &str,
    amount: u128,
    token_id: &str,
    store_state: bool,
    state_variables: &[StateValue],
    mmr_entry: u128,
) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    out.extend_from_slice(&write_hash(coin_id)?);
    out.extend_from_slice(&write_hash(address)?);
    out.extend_from_slice(&write_mini_number(amount)?);
    out.extend_from_slice(&write_hash(token_id)?);
    out.push(u8::from(store_state));
    out.extend_from_slice(&write_mmr_entry(mmr_entry)?);
    out.push(0);
    out.extend_from_slice(&write_mini_number(0)?);
    out.extend_from_slice(&write_mini_number(state_variables.len() as u128)?);
    for value in state_variables {
        out.extend_from_slice(&write_state_value(value)?);
    }
    out.push(0);
    Ok(out)
}

/// Output coin ids, matching `minimaOutputCoinIdsForDraft`.
pub fn output_coin_ids(draft: &TxDraft) -> Result<Vec<String>, String> {
    if draft.inputs.is_empty() {
        return Ok(draft.outputs.iter().map(|_| COINID_OUTPUT.to_string()).collect());
    }
    let base = draft.inputs[0]
        .coin_id
        .as_deref()
        .unwrap_or(COINID_OUTPUT);
    if base.eq_ignore_ascii_case(COINID_ELTOO) {
        return Ok(draft.outputs.iter().map(|_| COINID_OUTPUT.to_string()).collect());
    }
    let mut ids = Vec::with_capacity(draft.outputs.len());
    for index in 0..draft.outputs.len() {
        let mut data = write_mini_data(&hex_to_bytes(base)?);
        data.extend_from_slice(&write_mini_number(index as u128)?);
        let mut hasher = Sha3_256::new();
        hasher.update(&data);
        ids.push(bytes_to_hex(&hasher.finalize()));
    }
    Ok(ids)
}

/// Canonical Minima transaction bytes.
pub fn canonical_bytes(draft: &TxDraft) -> Result<Vec<u8>, String> {
    let output_ids = output_coin_ids(draft)?;
    let mut out = Vec::new();

    out.extend_from_slice(&write_mini_number(draft.inputs.len() as u128)?);
    for input in &draft.inputs {
        out.extend_from_slice(&serialize_coin(
            input.coin_id.as_deref().unwrap_or(COINID_OUTPUT),
            &input.address,
            parse_amount(&input.amount)?,
            &input.token_id,
            input.store_state.unwrap_or(false),
            input.state_variables.as_deref().unwrap_or(&[]),
            input.mmr_entry.as_ref().map(parse_amount).transpose()?.unwrap_or(0),
        )?);
    }

    out.extend_from_slice(&write_mini_number(draft.outputs.len() as u128)?);
    for (index, output) in draft.outputs.iter().enumerate() {
        let store_state = output.store_state.unwrap_or(false);
        let variables: &[StateValue] = if store_state {
            match &output.state_variables {
                Some(values) => values.as_slice(),
                None => state_variables_ref(&draft.state_variables),
            }
        } else {
            &[]
        };
        out.extend_from_slice(&serialize_coin(
            &output_ids[index],
            &output.address,
            parse_amount(&output.amount)?,
            &output.token_id,
            store_state,
            variables,
            output.mmr_entry.as_ref().map(parse_amount).transpose()?.unwrap_or(0),
        )?);
    }

    out.extend_from_slice(&write_mini_number(draft.state_variables.len() as u128)?);
    for value in &draft.state_variables {
        out.extend_from_slice(&write_state_value(value)?);
    }
    out.extend_from_slice(&write_hash("0x00")?);
    Ok(out)
}

fn state_variables_ref(values: &[StateValue]) -> &[StateValue] {
    values
}

/// Parse a serialized draft (`serializeTxDraft` output: hex-encoded JSON).
pub fn draft_from_hex(tx_hex: &str) -> Result<TxDraft, String> {
    let bytes = hex_to_bytes(tx_hex)?;
    let text = String::from_utf8(bytes).map_err(|_| "Draft hex is not UTF-8 JSON".to_string())?;
    serde_json::from_str(&text).map_err(|error| format!("Invalid draft JSON: {error}"))
}

/// SHA3-256 of the canonical transaction bytes.
pub fn digest_from_hex(tx_hex: &str) -> Result<[u8; 32], String> {
    let draft = draft_from_hex(tx_hex)?;
    let bytes = canonical_bytes(&draft)?;
    let mut hasher = Sha3_256::new();
    hasher.update(&bytes);
    let output = hasher.finalize();
    let mut digest = [0u8; 32];
    digest.copy_from_slice(&output);
    Ok(digest)
}
