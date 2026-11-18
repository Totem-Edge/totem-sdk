//! Canonical Minima transaction serialisation and digests.
//!
//! Byte-for-byte port of the TypeScript `omniaDraftToCanonicalMinimaBytes` /
//! `computeOmniaTxDigest`. The signed payload is the SHA3-256 of these bytes, so
//! any divergence here would silently invalidate (or forge) channel signatures.

use num_bigint::BigUint;
use num_traits::Zero;
use serde::Deserialize;
use serde_json::Value;
use sha3::{Digest, Sha3_256};

use crate::types::StateValue;

const COINID_OUTPUT: &str = "0x00";
const COINID_ELTOO: &str = "0x01";

/// Decimal places of a Minima `MiniNumber` that encodes a coin amount.
///
/// The Java implementation exposes `MiniNumber.MAX_DECIMAL_PLACES = 64 - 20 = 44`,
/// so a coin amount of `atoms` base units is written as
/// `MiniNumber(unscaled = atoms, scale = 44)`, i.e.
/// `value = atoms * 10^-44` MINIMA.
///
/// Counts, indexes, MMR entry numbers, block numbers, sequence numbers and
/// state-variable numbers are integers and stay at scale 0.
pub const COIN_AMOUNT_SCALE: u32 = 44;

/// Largest scale a `MiniNumber` can carry (the scale is written as a single byte).
const MAX_MINI_NUMBER_SCALE: u32 = u8::MAX as u32;

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
    if !raw.len().is_multiple_of(2) {
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

/// Parse a draft amount into integer atoms: either a plain JSON number, a
/// decimal string, or the `__bigint__` marker produced by the SDK's
/// `bigintReplacer`. Amounts are unbounded (1 MINIMA = 10^44 atoms).
pub fn parse_amount(value: &Value) -> Result<BigUint, String> {
    match value {
        Value::String(text) => {
            let raw = text.strip_prefix("__bigint__").unwrap_or(text);
            raw.parse::<BigUint>()
                .map_err(|_| format!("Invalid amount: {text:?}"))
        }
        Value::Number(number) => number
            .as_u64()
            .map(BigUint::from)
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

/// Big-endian, two's-complement-style bytes exactly as Java's
/// `BigInteger.toByteArray()` emits them for a non-negative value: no leading
/// zero bytes, and one `0x00` prefix when the high bit would otherwise mark the
/// value as negative. Zero is `[0x00]`.
fn java_bytes(value: &BigUint) -> Vec<u8> {
    if value.is_zero() {
        return vec![0];
    }
    let mut bytes = value.to_bytes_be();
    if bytes[0] & 0x80 != 0 {
        bytes.insert(0, 0);
    }
    bytes
}

/// `MiniNumber(unscaled, scale)`: `[scale][byteLength][unscaled big-endian bytes]`.
///
/// The unscaled value is not adjusted for the scale, so a coin amount must be
/// written as `write_mini_number(&atoms, COIN_AMOUNT_SCALE)`.
fn write_mini_number(value: &BigUint, scale: u32) -> Result<Vec<u8>, String> {
    if scale > MAX_MINI_NUMBER_SCALE {
        return Err(format!("MiniNumber scale out of range: {scale}"));
    }
    let unscaled = java_bytes(value);
    if unscaled.len() > 255 {
        return Err(format!("MiniNumber data too large: {}", unscaled.len()));
    }
    let mut out = Vec::with_capacity(2 + unscaled.len());
    out.push(scale as u8);
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

fn write_mmr_entry(value: &BigUint) -> Result<Vec<u8>, String> {
    let mut out = write_mini_number(&BigUint::zero(), 0)?;
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
            // Counts/sequences use scale 0; amount ports declare scale 44.
            out.extend_from_slice(&write_mini_number(
                &parse_amount(&value.value)?,
                value.scale.unwrap_or(0),
            )?);
        }
        "hex" => {
            out.push(1);
            out.extend_from_slice(&write_mini_data(&hex_to_bytes(&value_as_string(
                &value.value,
            ))?));
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
    amount: &BigUint,
    token_id: &str,
    store_state: bool,
    state_variables: &[StateValue],
    mmr_entry: &BigUint,
) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    out.extend_from_slice(&write_hash(coin_id)?);
    out.extend_from_slice(&write_hash(address)?);
    // Coin amounts are atoms: MiniNumber(unscaled = atoms, scale = 44).
    out.extend_from_slice(&write_mini_number(amount, COIN_AMOUNT_SCALE)?);
    out.extend_from_slice(&write_hash(token_id)?);
    out.push(u8::from(store_state));
    out.extend_from_slice(&write_mmr_entry(mmr_entry)?);
    out.push(0);
    out.extend_from_slice(&write_mini_number(&BigUint::zero(), 0)?);
    out.extend_from_slice(&write_mini_number(
        &BigUint::from(state_variables.len()),
        0,
    )?);
    for value in state_variables {
        out.extend_from_slice(&write_state_value(value)?);
    }
    out.push(0);
    Ok(out)
}

/// Output coin ids, matching `minimaOutputCoinIdsForDraft`.
pub fn output_coin_ids(draft: &TxDraft) -> Result<Vec<String>, String> {
    if draft.inputs.is_empty() {
        return Ok(draft
            .outputs
            .iter()
            .map(|_| COINID_OUTPUT.to_string())
            .collect());
    }
    let base = draft.inputs[0].coin_id.as_deref().unwrap_or(COINID_OUTPUT);
    if base.eq_ignore_ascii_case(COINID_ELTOO) {
        return Ok(draft
            .outputs
            .iter()
            .map(|_| COINID_OUTPUT.to_string())
            .collect());
    }
    let mut ids = Vec::with_capacity(draft.outputs.len());
    for index in 0..draft.outputs.len() {
        let mut data = write_mini_data(&hex_to_bytes(base)?);
        data.extend_from_slice(&write_mini_number(&BigUint::from(index), 0)?);
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

    out.extend_from_slice(&write_mini_number(&BigUint::from(draft.inputs.len()), 0)?);
    for input in &draft.inputs {
        out.extend_from_slice(&serialize_coin(
            input.coin_id.as_deref().unwrap_or(COINID_OUTPUT),
            &input.address,
            &parse_amount(&input.amount)?,
            &input.token_id,
            input.store_state.unwrap_or(false),
            input.state_variables.as_deref().unwrap_or(&[]),
            &input
                .mmr_entry
                .as_ref()
                .map(parse_amount)
                .transpose()?
                .unwrap_or_else(BigUint::zero),
        )?);
    }

    out.extend_from_slice(&write_mini_number(&BigUint::from(draft.outputs.len()), 0)?);
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
            &parse_amount(&output.amount)?,
            &output.token_id,
            store_state,
            variables,
            &output
                .mmr_entry
                .as_ref()
                .map(parse_amount)
                .transpose()?
                .unwrap_or_else(BigUint::zero),
        )?);
    }

    out.extend_from_slice(&write_mini_number(
        &BigUint::from(draft.state_variables.len()),
        0,
    )?);
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn hex_of(len: usize, byte: u8) -> String {
        format!("0x{}", hex::encode(vec![byte; len]))
    }

    fn draft_with_amount(amount: &Value) -> TxDraft {
        serde_json::from_value(json!({
            "type": "eltoo_update",
            "inputs": [{
                "coinId": hex_of(32, 0x11),
                "address": hex_of(32, 0x22),
                "amount": amount,
                "tokenId": hex_of(32, 0x00),
            }],
            "outputs": [{
                "address": hex_of(32, 0x22),
                "amount": amount,
                "tokenId": hex_of(32, 0x00),
                "storeState": false,
            }],
            "stateVariables": [
                { "port": 120, "type": "number", "value": "__bigint__42" }
            ],
            "storeState": false,
        }))
        .unwrap()
    }

    /// Minimal forward reader used to assert the exact wire layout.
    struct Reader<'a> {
        bytes: &'a [u8],
        pos: usize,
    }

    impl<'a> Reader<'a> {
        fn new(bytes: &'a [u8]) -> Self {
            Self { bytes, pos: 0 }
        }

        fn byte(&mut self) -> u8 {
            let value = self.bytes[self.pos];
            self.pos += 1;
            value
        }

        fn take(&mut self, len: usize) -> &'a [u8] {
            let slice = &self.bytes[self.pos..self.pos + len];
            self.pos += len;
            slice
        }

        /// Returns `(scale, unscaled big-endian bytes)`.
        fn mini_number(&mut self) -> (u8, &'a [u8]) {
            let scale = self.byte();
            let len = self.byte() as usize;
            (scale, self.take(len))
        }

        fn mini_data(&mut self) -> &'a [u8] {
            let len = u32::from_be_bytes(self.take(4).try_into().unwrap()) as usize;
            self.take(len)
        }

        fn coin(&mut self) {
            self.mini_data(); // coinId
            self.mini_data(); // address
            self.mini_number(); // amount
            self.mini_data(); // tokenId
            self.byte(); // storeState
            self.mini_number(); // MMR entry number wrapper (scale 0)
            self.mini_data(); // MMR entry number
            self.byte(); // hasBurned
            self.mini_number(); // burn value
            let state_len = self.mini_number();
            assert_eq!(state_len.0, 0);
            for _ in 0..unscaled_usize(state_len.1) {
                let _port = self.byte();
                let state_type = self.byte();
                if state_type == 2 {
                    let value = self.mini_number();
                    assert_eq!(value.0, 0, "state-variable numbers stay scale 0");
                } else {
                    self.mini_data();
                }
            }
            self.byte(); // final flag
        }
    }

    fn unscaled_usize(bytes: &[u8]) -> usize {
        bytes
            .iter()
            .fold(0usize, |acc, byte| (acc << 8) | *byte as usize)
    }

    #[test]
    fn coin_amounts_are_written_as_atoms_at_scale_44() {
        let draft = draft_with_amount(&json!("5"));
        let bytes = canonical_bytes(&draft).unwrap();
        let mut reader = Reader::new(&bytes);

        let input_count = reader.mini_number();
        assert_eq!(input_count, (0, &[1u8][..]), "input count stays scale 0");

        reader.mini_data();
        reader.mini_data();
        let amount = reader.mini_number();
        assert_eq!(amount, (COIN_AMOUNT_SCALE as u8, &[5u8][..]));
        assert_eq!(COIN_AMOUNT_SCALE, 44);

        reader.mini_data();
        reader.byte(); // storeState
        let mmr_scale = reader.mini_number();
        assert_eq!(mmr_scale.0, 0, "MMR entry numbers stay scale 0");
        reader.mini_data();
        reader.byte();
        let burn = reader.mini_number();
        assert_eq!(burn.0, 0, "burn values stay scale 0");
        let state_count = reader.mini_number();
        assert_eq!(
            state_count,
            (0, &[0u8][..]),
            "coins without storeState carry no state variables"
        );
        reader.byte(); // final flag

        let output_count = reader.mini_number();
        assert_eq!(output_count, (0, &[1u8][..]));
        reader.mini_data();
        reader.mini_data();
        let output_amount = reader.mini_number();
        assert_eq!(output_amount, (COIN_AMOUNT_SCALE as u8, &[5u8][..]));

        // Walk both coins end-to-end to prove the layout the assertions above assume.
        let mut walker = Reader::new(&bytes);
        walker.mini_number();
        walker.coin();
        walker.mini_number();
        walker.coin();
        walker.mini_number(); // transaction state variables
        walker.byte();
        walker.byte();
        let value = walker.mini_number();
        assert_eq!(value, (0, &[42u8][..]));
        walker.mini_data(); // final 0x00 hash
        assert_eq!(walker.pos, bytes.len());
    }

    #[test]
    fn whole_minima_is_10_pow_44_atoms_at_scale_44() {
        let atoms = BigUint::from(10u32).pow(44);
        assert_eq!(atoms.to_string(), format!("1{}", "0".repeat(44)));

        let draft = draft_with_amount(&json!(
            "__bigint__100000000000000000000000000000000000000000000"
        ));
        let bytes = canonical_bytes(&draft).unwrap();
        let mut reader = Reader::new(&bytes);
        reader.mini_number();
        reader.mini_data();
        reader.mini_data();
        let (scale, unscaled) = reader.mini_number();
        assert_eq!(scale, 44);
        assert_eq!(BigUint::from_bytes_be(unscaled), atoms);
        assert_eq!(unscaled.len(), 19, "10^44 needs 19 big-endian bytes");
    }

    #[test]
    fn java_bytes_matches_big_integer_to_byte_array() {
        let cases: [(u32, &[u8]); 6] = [
            (0, &[0x00]),
            (1, &[0x01]),
            (127, &[0x7f]),
            (128, &[0x00, 0x80]),
            (255, &[0x00, 0xff]),
            (256, &[0x01, 0x00]),
        ];
        for (value, expected) in cases {
            assert_eq!(java_bytes(&BigUint::from(value)), expected, "value {value}");
        }
    }

    #[test]
    fn mini_number_is_scale_then_length_then_unscaled_bytes() {
        assert_eq!(
            write_mini_number(&BigUint::from(5u32), 44).unwrap(),
            vec![44, 1, 5]
        );
        assert_eq!(
            write_mini_number(&BigUint::from(0u32), 0).unwrap(),
            vec![0, 1, 0]
        );
        assert!(write_mini_number(&BigUint::from(1u32), 256).is_err());
    }

    #[test]
    fn parse_amount_accepts_strings_numbers_and_bigint_marker() {
        assert_eq!(
            parse_amount(&json!("1000")).unwrap(),
            BigUint::from(1000u32)
        );
        assert_eq!(
            parse_amount(&json!("__bigint__1000")).unwrap(),
            BigUint::from(1000u32)
        );
        assert_eq!(parse_amount(&json!(1000)).unwrap(), BigUint::from(1000u32));
        assert_eq!(
            parse_amount(&json!("__bigint__340282366920938463463374607431768211456"))
                .unwrap()
                .to_string(),
            "340282366920938463463374607431768211456"
        );
        assert!(parse_amount(&json!("-1")).is_err());
        assert!(parse_amount(&json!("not-a-number")).is_err());
        assert!(parse_amount(&json!(true)).is_err());
    }
}
