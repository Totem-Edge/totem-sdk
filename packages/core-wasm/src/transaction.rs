/// Transaction serialization and digest computation.
///
/// Matches Minima's Java transaction serialization byte-for-byte.
///
/// Java reference:
///   Transaction.writeDataStream()  — top-level TX serialization
///   Coin.writeDataStream()         — per-input / per-output coin serialization
///   StateVariable.writeDataStream() — state variable serialization
///   Token.writeDataStream()        — token descriptor serialization
///
/// Binary format (Java writeDataStream order):
///
///   Transaction:
///     MiniNumber(input_count)
///     for each input:  Coin bytes
///     MiniNumber(output_count)
///     for each output: Coin bytes
///     MiniNumber(state_count)
///     for each sv:     StateVariable bytes
///     linkHash.writeHashToStream()   // 4-byte len + 32 bytes
///
///   Coin:
///     coinID.writeHashToStream()     // 4-byte len + 32 bytes
///     address.writeHashToStream()    // 4-byte len + 32 bytes
///     amount.writeDataStream()       // MiniNumber: scale(1) + len(1) + bytes
///     tokenID.writeHashToStream()    // 4-byte len + 32 bytes
///     MiniByte(storeState)           // 1 byte
///     mmrEntryNumber.writeDataStream() // MiniNumber(scale) + MiniData(unscaled)
///     MiniByte(spent)                // 1 byte
///     blockCreated.writeDataStream() // MiniNumber
///     MiniNumber(coin_state_count)
///     for each sv: StateVariable bytes
///     MiniByte(hasToken)            // 1 byte
///     if hasToken: Token bytes
///
///   StateVariable:
///     MiniByte(port)                 // 1 byte
///     MiniByte(type)                 // 1 byte: 1=HEX, 2=NUMBER, 4=STRING, 8=BOOL
///     data (type-dependent):
///       BOOL:   MiniByte
///       HEX:    MiniData (4-byte len + bytes)
///       NUMBER: MiniNumber (scale + len + bytes)
///       STRING: MiniString = MiniData(UTF-8 bytes)
///
///   Token:
///     coinId.writeHashToStream()
///     script.writeDataStream()      // MiniData
///     scale.writeDataStream()       // MiniNumber
///     totalAmount.writeDataStream() // MiniNumber
///     name.writeDataStream()        // MiniData
///     created.writeDataStream()     // MiniNumber

use sha3::{Digest, Sha3_256};
use serde::Deserialize;

use crate::streamable::{
    write_mini_number, write_mini_data,
    write_hash_to_stream,
};

// ── State variable type constants (match Java StateVariable) ──────────────

const STATETYPE_HEX: u8 = 1;
const STATETYPE_NUMBER: u8 = 2;
const STATETYPE_STRING: u8 = 4;
const STATETYPE_BOOL: u8 = 8;

// ── JSON input structures ─────────────────────────────────────────────────

fn default_zero() -> String { "0".into() }
fn default_zero_hex() -> String { "0x00".into() }
fn default_false() -> bool { false }
fn default_true() -> bool { true }
fn default_empty_state() -> Vec<StateVariableJson> { vec![] }

#[derive(Debug, Deserialize)]
pub struct TransactionInputJson {
    pub coinid: String,
    pub amount: String,
    pub address: String,
    pub tokenid: String,
    #[serde(default = "default_empty_state")]
    pub state: Vec<StateVariableJson>,
    #[serde(default = "default_true")]
    pub storestate: bool,
    #[serde(default = "default_zero")]
    pub mmrentry: String,
    #[serde(default = "default_false")]
    pub spent: bool,
    #[serde(default = "default_zero")]
    pub created: String,
    #[serde(default)]
    pub token: Option<TokenJson>,
}

#[derive(Debug, Deserialize)]
pub struct TransactionOutputJson {
    pub amount: String,
    pub address: String,
    pub tokenid: String,
    #[serde(default = "default_empty_state")]
    pub state: Vec<StateVariableJson>,
    #[serde(default = "default_true")]
    pub storestate: bool,
    #[serde(default = "default_zero")]
    pub mmrentry: String,
    #[serde(default = "default_false")]
    pub spent: bool,
    #[serde(default = "default_zero")]
    pub created: String,
    #[serde(default)]
    pub token: Option<TokenJson>,
}

#[derive(Debug, Deserialize)]
pub struct MinimaTransactionJson {
    #[serde(default)]
    pub inputs: Vec<TransactionInputJson>,
    #[serde(default)]
    pub outputs: Vec<TransactionOutputJson>,
    #[serde(default)]
    pub state: Vec<StateVariableJson>,
    #[serde(default = "default_zero_hex")]
    pub linkhash: String,
}

#[derive(Debug, Deserialize)]
pub struct StateVariableJson {
    pub port: u32,
    #[serde(alias = "type")]
    pub svtype: Option<String>,
    pub data: String,
}

#[derive(Debug, Deserialize)]
pub struct TokenJson {
    #[serde(default = "default_zero_hex")]
    pub coinid: String,
    #[serde(default)]
    pub scale: String,
    #[serde(default = "default_zero")]
    pub totalamount: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub script: String,
    #[serde(default = "default_zero")]
    pub created: String,
}

// ── Helpers ───────────────────────────────────────────────────────────────

fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, String> {
    let s = hex.trim_start_matches("0x");
    if s.is_empty() {
        return Ok(vec![]);
    }
    hex::decode(s).map_err(|e| format!("Invalid hex: {}", e))
}

/// Parse a decimal string into (unscaled big-endian bytes, scale).
///
/// "1000"   → (vec![0x03, 0xE8], 0)
/// "0.001"  → (vec![0x01], 3)
/// "0"      → (vec![0x00], 0)
fn parse_decimal(s: &str) -> Result<(Vec<u8>, u8), String> {
    let s = s.trim();
    if s.is_empty() {
        return Ok((vec![0], 0));
    }

    let (int_part, frac_part) = match s.find('.') {
        Some(dot) => (&s[..dot], &s[dot + 1..]),
        None => (s, ""),
    };

    let scale = frac_part.len() as u8;
    let combined = format!("{}{}", int_part, frac_part);
    let trimmed = combined.trim_start_matches('0');
    let digits = if trimmed.is_empty() { "0" } else { trimmed };

    // Convert decimal string to big-endian bytes
    let mut bytes = vec![0u8];
    for ch in digits.bytes() {
        if !ch.is_ascii_digit() {
            return Err(format!("Invalid decimal character '{}' in '{}'", ch as char, s));
        }
        let digit = (ch - b'0') as u16;
        // multiply current by 10 and add digit
        let mut carry = digit;
        for b in bytes.iter_mut().rev() {
            let val = (*b as u16) * 10 + carry;
            *b = (val & 0xFF) as u8;
            carry = val >> 8;
        }
        while carry > 0 {
            bytes.insert(0, (carry & 0xFF) as u8);
            carry >>= 8;
        }
    }

    // Remove leading zeros
    while bytes.len() > 1 && bytes[0] == 0 {
        bytes.remove(0);
    }

    Ok((bytes, scale))
}

/// Write a MiniNumber from a decimal string.
fn write_mini_number_from_str(s: &str) -> Result<Vec<u8>, String> {
    let (unscaled, scale) = parse_decimal(s)?;
    if unscaled.len() > 255 {
        return Err(format!("MiniNumber data too large: {} bytes", unscaled.len()));
    }
    let mut buf = Vec::with_capacity(2 + unscaled.len());
    buf.push(scale);
    buf.push(unscaled.len() as u8);
    buf.extend_from_slice(&unscaled);
    Ok(buf)
}

/// Write an MMREntryNumber from a decimal string.
fn write_mmr_entry_from_str(s: &str) -> Result<Vec<u8>, String> {
    let (unscaled, scale) = parse_decimal(s)?;
    let mut buf = Vec::new();
    // Scale as MiniNumber
    buf.push(scale);
    buf.push(unscaled.len() as u8);
    buf.extend_from_slice(&unscaled);
    // Unscaled value as MiniData
    buf.extend_from_slice(&write_mini_data(&unscaled));
    Ok(buf)
}

/// Determine the state variable type byte from the JSON type field.
fn resolve_sv_type(svtype: &Option<String>, data: &str) -> u8 {
    match svtype {
        Some(t) => match t.as_str() {
            "hex" | "HEX" => STATETYPE_HEX,
            "number" | "NUMBER" => STATETYPE_NUMBER,
            "string" | "STRING" => STATETYPE_STRING,
            "bool" | "BOOL" => STATETYPE_BOOL,
            other => {
                // Try parsing as a numeric type byte
                other.parse::<u8>().unwrap_or(STATETYPE_HEX)
            }
        },
        None => {
            // Auto-detect from data value
            if data.eq_ignore_ascii_case("true") || data.eq_ignore_ascii_case("false") {
                STATETYPE_BOOL
            } else if data.starts_with("0x") || data.starts_with("0X") {
                STATETYPE_HEX
            } else if data.starts_with("[") && data.ends_with("]") {
                STATETYPE_STRING
            } else {
                STATETYPE_NUMBER
            }
        }
    }
}

// ── Serialization functions ───────────────────────────────────────────────

fn serialize_state_variable(sv: &StateVariableJson) -> Result<Vec<u8>, String> {
    if sv.port > 255 {
        return Err(format!("StateVariable port must be 0-255, got {}", sv.port));
    }

    let svtype = resolve_sv_type(&sv.svtype, &sv.data);
    let mut buf = Vec::new();

    // port (MiniByte)
    buf.push(sv.port as u8);
    // type (MiniByte)
    buf.push(svtype);

    // data (type-dependent)
    match svtype {
        STATETYPE_BOOL => {
            let val = sv.data.eq_ignore_ascii_case("true") || sv.data == "01" || sv.data == "1";
            buf.push(if val { 1 } else { 0 });
        }
        STATETYPE_HEX => {
            let bytes = hex_to_bytes(&sv.data)?;
            buf.extend_from_slice(&write_mini_data(&bytes));
        }
        STATETYPE_NUMBER => {
            let num_bytes = write_mini_number_from_str(&sv.data)?;
            buf.extend_from_slice(&num_bytes);
        }
        STATETYPE_STRING => {
            let utf8 = sv.data.as_bytes();
            buf.extend_from_slice(&write_mini_data(utf8));
        }
        _ => return Err(format!("Unknown StateVariable type: {}", svtype)),
    }

    Ok(buf)
}

fn serialize_token(token: &TokenJson) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();

    // coinId.writeHashToStream()
    let coinid = hex_to_bytes(&token.coinid)?;
    buf.extend_from_slice(&write_hash_to_stream(&coinid));

    // script.writeDataStream() — MiniData
    let script = if token.script.is_empty() {
        hex_to_bytes("0x00")?
    } else if token.script.starts_with("0x") {
        hex_to_bytes(&token.script)?
    } else {
        token.script.as_bytes().to_vec()
    };
    buf.extend_from_slice(&write_mini_data(&script));

    // scale.writeDataStream() — MiniNumber
    buf.extend_from_slice(&write_mini_number_from_str(&token.scale)?);

    // totalAmount.writeDataStream() — MiniNumber
    buf.extend_from_slice(&write_mini_number_from_str(&token.totalamount)?);

    // name.writeDataStream() — MiniData
    let name_bytes = token.name.as_bytes();
    buf.extend_from_slice(&write_mini_data(name_bytes));

    // created.writeDataStream() — MiniNumber
    buf.extend_from_slice(&write_mini_number_from_str(&token.created)?);

    Ok(buf)
}

fn serialize_coin_input(input: &TransactionInputJson) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();

    // coinID.writeHashToStream()
    let coinid = hex_to_bytes(&input.coinid)?;
    buf.extend_from_slice(&write_hash_to_stream(&coinid));

    // address.writeHashToStream()
    let address = hex_to_bytes(&input.address)?;
    buf.extend_from_slice(&write_hash_to_stream(&address));

    // amount.writeDataStream() — MiniNumber
    buf.extend_from_slice(&write_mini_number_from_str(&input.amount)?);

    // tokenID.writeHashToStream()
    let tokenid = hex_to_bytes(&input.tokenid)?;
    buf.extend_from_slice(&write_hash_to_stream(&tokenid));

    // MiniByte(storeState)
    buf.push(if input.storestate { 1 } else { 0 });

    // mmrEntryNumber.writeDataStream()
    buf.extend_from_slice(&write_mmr_entry_from_str(&input.mmrentry)?);

    // MiniByte(spent)
    buf.push(if input.spent { 1 } else { 0 });

    // blockCreated.writeDataStream() — MiniNumber
    buf.extend_from_slice(&write_mini_number_from_str(&input.created)?);

    // MiniNumber(coin_state_count) + state variables
    let state_count = input.state.len();
    buf.extend_from_slice(&write_mini_number(state_count as i64, 0));
    for sv in &input.state {
        buf.extend_from_slice(&serialize_state_variable(sv)?);
    }

    // MiniByte(hasToken) + optional Token
    if let Some(ref token) = input.token {
        buf.push(1);
        buf.extend_from_slice(&serialize_token(token)?);
    } else {
        buf.push(0);
    }

    Ok(buf)
}

fn serialize_coin_output(output: &TransactionOutputJson) -> Result<Vec<u8>, String> {
    // Output coins use COINID_OUTPUT (0x00) as coinId
    let coinid = vec![0x00];

    let mut buf = Vec::new();

    // coinID.writeHashToStream()
    buf.extend_from_slice(&write_hash_to_stream(&coinid));

    // address.writeHashToStream()
    let address = hex_to_bytes(&output.address)?;
    buf.extend_from_slice(&write_hash_to_stream(&address));

    // amount.writeDataStream()
    buf.extend_from_slice(&write_mini_number_from_str(&output.amount)?);

    // tokenID.writeHashToStream()
    let tokenid = hex_to_bytes(&output.tokenid)?;
    buf.extend_from_slice(&write_hash_to_stream(&tokenid));

    // MiniByte(storeState)
    buf.push(if output.storestate { 1 } else { 0 });

    // mmrEntryNumber.writeDataStream()
    buf.extend_from_slice(&write_mmr_entry_from_str(&output.mmrentry)?);

    // MiniByte(spent)
    buf.push(if output.spent { 1 } else { 0 });

    // blockCreated.writeDataStream()
    buf.extend_from_slice(&write_mini_number_from_str(&output.created)?);

    // MiniNumber(coin_state_count) + state variables
    let state_count = output.state.len();
    buf.extend_from_slice(&write_mini_number(state_count as i64, 0));
    for sv in &output.state {
        buf.extend_from_slice(&serialize_state_variable(sv)?);
    }

    // MiniByte(hasToken) + optional Token
    if let Some(ref token) = output.token {
        buf.push(1);
        buf.extend_from_slice(&serialize_token(token)?);
    } else {
        buf.push(0);
    }

    Ok(buf)
}

// ── Public API ────────────────────────────────────────────────────────────

/// Serialize a transaction from JSON to canonical Java-compatible bytes.
pub fn serialize_transaction_from_json(json: &str) -> Result<Vec<u8>, String> {
    let tx: MinimaTransactionJson = serde_json::from_str(json)
        .map_err(|e| format!("Invalid transaction JSON: {}", e))?;

    let mut buf = Vec::new();

    // Input count (MiniNumber)
    buf.extend_from_slice(&write_mini_number(tx.inputs.len() as i64, 0));

    // Serialize each input
    for input in &tx.inputs {
        buf.extend_from_slice(&serialize_coin_input(input)?);
    }

    // Output count (MiniNumber)
    buf.extend_from_slice(&write_mini_number(tx.outputs.len() as i64, 0));

    // Serialize each output
    for output in &tx.outputs {
        buf.extend_from_slice(&serialize_coin_output(output)?);
    }

    // Top-level state count (MiniNumber)
    buf.extend_from_slice(&write_mini_number(tx.state.len() as i64, 0));

    // Serialize top-level state variables
    for sv in &tx.state {
        buf.extend_from_slice(&serialize_state_variable(sv)?);
    }

    // linkHash.writeHashToStream()
    let linkhash = hex_to_bytes(&tx.linkhash)?;
    buf.extend_from_slice(&write_hash_to_stream(&linkhash));

    Ok(buf)
}

/// Compute transaction digest: SHA3-256 of serialized transaction.
pub fn compute_transaction_digest(serialized_tx: &[u8]) -> Vec<u8> {
    let mut hasher = Sha3_256::new();
    hasher.update(serialized_tx);
    hasher.finalize().to_vec()
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serialize_empty_transaction() {
        let json = r#"{"inputs":[],"outputs":[],"state":[],"linkhash":"0x00"}"#;
        let result = serialize_transaction_from_json(json).unwrap();
        // Input count MiniNumber(0): [00 01 00] = 3 bytes
        // Output count MiniNumber(0): [00 01 00] = 3 bytes
        // State count MiniNumber(0): [00 01 00] = 3 bytes
        // linkHash: 4-byte len + 1 byte (0x00) = 5 bytes
        assert_eq!(result.len(), 14);
    }

    #[test]
    fn test_serialize_simple_transaction() {
        let json = r#"{
            "inputs":[{
                "coinid":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "amount":"1000",
                "address":"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "tokenid":"0x00"
            }],
            "outputs":[{
                "amount":"1000",
                "address":"0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                "tokenid":"0x00"
            }],
            "state":[],
            "linkhash":"0x00"
        }"#;
        let result = serialize_transaction_from_json(json).unwrap();
        assert!(result.len() > 50);
    }

    #[test]
    fn test_serialize_with_state_variables() {
        let json = r#"{
            "inputs":[],
            "outputs":[],
            "state":[
                {"port":100,"svtype":"bool","data":"false"},
                {"port":101,"svtype":"number","data":"5"}
            ],
            "linkhash":"0x00"
        }"#;
        let result = serialize_transaction_from_json(json).unwrap();
        assert!(result.len() > 14);
    }

    #[test]
    fn test_compute_digest_length() {
        let digest = compute_transaction_digest(&[1, 2, 3]);
        assert_eq!(digest.len(), 32);
    }

    #[test]
    fn test_compute_digest_deterministic() {
        let data = b"test transaction";
        let d1 = compute_transaction_digest(data);
        let d2 = compute_transaction_digest(data);
        assert_eq!(d1, d2);
    }

    #[test]
    fn test_parse_decimal_integer() {
        let (bytes, scale) = parse_decimal("1000").unwrap();
        assert_eq!(scale, 0);
        // 1000 = 0x03E8
        assert_eq!(bytes, vec![0x03, 0xE8]);
    }

    #[test]
    fn test_parse_decimal_with_scale() {
        let (bytes, scale) = parse_decimal("0.001").unwrap();
        assert_eq!(scale, 3);
        assert_eq!(bytes, vec![0x01]);
    }

    #[test]
    fn test_parse_decimal_zero() {
        let (bytes, scale) = parse_decimal("0").unwrap();
        assert_eq!(scale, 0);
        assert_eq!(bytes, vec![0x00]);
    }

    #[test]
    fn test_serialize_state_variable_bool() {
        let sv = StateVariableJson {
            port: 100,
            svtype: Some("bool".into()),
            data: "false".into(),
        };
        let result = serialize_state_variable(&sv).unwrap();
        // port(1) + type(1) + bool(1) = 3 bytes
        assert_eq!(result.len(), 3);
        assert_eq!(result[0], 100);
        assert_eq!(result[1], STATETYPE_BOOL);
        assert_eq!(result[2], 0);
    }

    #[test]
    fn test_serialize_state_variable_number() {
        let sv = StateVariableJson {
            port: 101,
            svtype: Some("number".into()),
            data: "5".into(),
        };
        let result = serialize_state_variable(&sv).unwrap();
        // port(1) + type(1) + MiniNumber(5) = 1+1+2+1 = 5 bytes
        assert_eq!(result[0], 101);
        assert_eq!(result[1], STATETYPE_NUMBER);
        // MiniNumber: scale=0, len=1, value=5
        assert_eq!(result[2], 0);
        assert_eq!(result[3], 1);
        assert_eq!(result[4], 5);
    }

    #[test]
    fn test_serialize_state_variable_hex() {
        let sv = StateVariableJson {
            port: 102,
            svtype: Some("hex".into()),
            data: "0xAABB".into(),
        };
        let result = serialize_state_variable(&sv).unwrap();
        // port(1) + type(1) + MiniData(4+2) = 8 bytes
        assert_eq!(result[0], 102);
        assert_eq!(result[1], STATETYPE_HEX);
        // MiniData: len=2 (4 bytes BE), data=AABB
        assert_eq!(&result[2..6], &[0, 0, 0, 2]);
        assert_eq!(&result[6..8], &[0xAA, 0xBB]);
    }
}
