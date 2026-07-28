use crate::types::*;
use sha3::{Digest, Sha3_256};

pub fn sha3_256_hex(data: &[u8]) -> String {
    let mut hasher = Sha3_256::new();
    hasher.update(data);
    let result = hasher.finalize();
    hex::encode(result)
}

pub fn compute_multisig_address(config: &MultisigConfig) -> Result<MultisigAddressResult, String> {
    let script = if config.config_type == "2of2" {
        if config.public_keys.len() != 2 {
            return Err("2-of-2 multisig requires exactly 2 public keys".to_string());
        }
        format!(
            "MULTISIG 2 {} {}",
            config.public_keys[0].to_uppercase(),
            config.public_keys[1].to_uppercase()
        )
    } else {
        let keys = config
            .public_keys
            .iter()
            .map(|k| k.to_uppercase())
            .collect::<Vec<_>>()
            .join(" ");
        format!("MULTISIG {} {}", config.threshold, keys)
    };

    let script_bytes = script.as_bytes();
    let hash = sha3_256_hex(script_bytes);
    let address = format!("0x{}", hash);

    Ok(MultisigAddressResult {
        address,
        script_hash: hash,
    })
}

pub fn recompute_digest(transaction_hex: &str) -> Result<String, String> {
    let tx_bytes =
        hex::decode(transaction_hex).map_err(|e| format!("Invalid hex: {}", e))?;
    Ok(sha3_256_hex(&tx_bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sha3_256_hex() {
        let result = sha3_256_hex(b"hello");
        assert_eq!(result.len(), 64);
    }

    #[test]
    fn test_compute_multisig_address_2of2() {
        let config = MultisigConfig {
            config_type: "2of2".to_string(),
            threshold: 2,
            public_keys: vec![
                "abc123".to_string(),
                "def456".to_string(),
            ],
            own_public_key: "abc123".to_string(),
            address: None,
        };
        let result = compute_multisig_address(&config).unwrap();
        assert!(result.address.starts_with("0x"));
        assert_eq!(result.address.len(), 66);
    }

    #[test]
    fn test_compute_multisig_address_mofn() {
        let config = MultisigConfig {
            config_type: "mofn".to_string(),
            threshold: 3,
            public_keys: vec![
                "aaa".to_string(),
                "bbb".to_string(),
                "ccc".to_string(),
                "ddd".to_string(),
            ],
            own_public_key: "aaa".to_string(),
            address: None,
        };
        let result = compute_multisig_address(&config).unwrap();
        assert!(result.address.starts_with("0x"));
    }

    #[test]
    fn test_recompute_digest() {
        let hex = "deadbeef";
        let result = recompute_digest(hex).unwrap();
        assert_eq!(result.len(), 64);
    }
}
