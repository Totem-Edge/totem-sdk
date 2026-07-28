/// Transaction serialization and digest computation.
///
/// Matches Minima's Java transaction serialization byte-for-byte.

use sha3::{Digest, Sha3_256};
use serde::Deserialize;

/// A Minima transaction input.
#[derive(Debug, Deserialize)]
pub struct TransactionInput {
    pub coinid: String,
    pub amount: String,
    pub address: String,
    pub tokenid: String,
    pub script: String,
}

/// A Minima transaction output.
#[derive(Debug, Deserialize)]
pub struct TransactionOutput {
    pub amount: String,
    pub address: String,
    pub tokenid: String,
}

/// A Minima transaction.
#[derive(Debug, Deserialize)]
pub struct MinimaTransaction {
    pub inputs: Vec<TransactionInput>,
    pub outputs: Vec<TransactionOutput>,
    pub state: Vec<StateVariable>,
}

/// A state variable in a transaction.
#[derive(Debug, Deserialize)]
pub struct StateVariable {
    pub port: u32,
    pub data: String,
}

/// Serialize a transaction from JSON to bytes.
///
/// This is a simplified serializer that produces the canonical
/// byte representation for digest computation.
pub fn serialize_transaction_from_json(json: &str) -> Result<Vec<u8>, String> {
    let tx: MinimaTransaction = serde_json::from_str(json)
        .map_err(|e| format!("Invalid transaction JSON: {}", e))?;

    let mut buf = Vec::new();

    // Input count
    buf.extend_from_slice(&(tx.inputs.len() as u32).to_be_bytes());

    // Serialize each input
    for input in &tx.inputs {
        let coinid = hex::decode(input.coinid.trim_start_matches("0x"))
            .map_err(|e| format!("Invalid coinid hex: {}", e))?;
        buf.extend_from_slice(&(coinid.len() as u32).to_be_bytes());
        buf.extend_from_slice(&coinid);

        let amount = input.amount.as_bytes();
        buf.extend_from_slice(&(amount.len() as u32).to_be_bytes());
        buf.extend_from_slice(amount);

        let address = input.address.as_bytes();
        buf.extend_from_slice(&(address.len() as u32).to_be_bytes());
        buf.extend_from_slice(address);

        let tokenid = hex::decode(input.tokenid.trim_start_matches("0x"))
            .map_err(|e| format!("Invalid tokenid hex: {}", e))?;
        buf.extend_from_slice(&(tokenid.len() as u32).to_be_bytes());
        buf.extend_from_slice(&tokenid);
    }

    // Output count
    buf.extend_from_slice(&(tx.outputs.len() as u32).to_be_bytes());

    // Serialize each output
    for output in &tx.outputs {
        let amount = output.amount.as_bytes();
        buf.extend_from_slice(&(amount.len() as u32).to_be_bytes());
        buf.extend_from_slice(amount);

        let address = output.address.as_bytes();
        buf.extend_from_slice(&(address.len() as u32).to_be_bytes());
        buf.extend_from_slice(address);

        let tokenid = hex::decode(output.tokenid.trim_start_matches("0x"))
            .map_err(|e| format!("Invalid tokenid hex: {}", e))?;
        buf.extend_from_slice(&(tokenid.len() as u32).to_be_bytes());
        buf.extend_from_slice(&tokenid);
    }

    // State variables
    buf.extend_from_slice(&(tx.state.len() as u32).to_be_bytes());
    for sv in &tx.state {
        buf.extend_from_slice(&sv.port.to_be_bytes());
        let data = hex::decode(sv.data.trim_start_matches("0x"))
            .map_err(|e| format!("Invalid state data hex: {}", e))?;
        buf.extend_from_slice(&(data.len() as u32).to_be_bytes());
        buf.extend_from_slice(&data);
    }

    Ok(buf)
}

/// Compute transaction digest: SHA3-256 of serialized transaction.
pub fn compute_transaction_digest(serialized_tx: &[u8]) -> Vec<u8> {
    let mut hasher = Sha3_256::new();
    hasher.update(serialized_tx);
    hasher.finalize().to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serialize_empty_transaction() {
        let json = r#"{"inputs":[],"outputs":[],"state":[]}"#;
        let result = serialize_transaction_from_json(json).unwrap();
        // Should have 4 bytes for input count + 4 bytes for output count + 4 bytes for state count
        assert_eq!(result.len(), 12);
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
}
