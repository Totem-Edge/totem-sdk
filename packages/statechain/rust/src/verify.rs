use sha3::{Digest, Sha3_256};

use crate::types::{StateChain, VerifyResult};

fn sha3_256_hex(data: &[u8]) -> String {
    let mut hasher = Sha3_256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

fn hex_to_bytes(hex_str: &str) -> Result<Vec<u8>, String> {
    let cleaned = hex_str.trim_start_matches("0x").trim_start_matches("0X");
    hex::decode(cleaned).map_err(|e| format!("Invalid hex: {}", e))
}

pub fn verify_state_chain(
    chain: &StateChain,
    verify_blind_sig: &dyn Fn(&str, &[u8], &str) -> bool,
    verify_owner_sig: &dyn Fn(&str, &[u8], &str) -> bool,
    verify_transfer_key: &dyn Fn(&str, &str) -> bool,
) -> VerifyResult {
    let history = &chain.transfer_history;
    let depth = history.len() as u32;
    let root_owner = if depth == 0 {
        chain.current_owner.party_id.clone()
    } else {
        history[0].from.clone()
    };

    if depth == 0 {
        return VerifyResult {
            valid: true,
            depth: 0,
            root_owner,
            reason: None,
        };
    }

    for i in 0..history.len() {
        let record = &history[i];

        if i > 0 {
            let prev = &history[i - 1];
            if prev.to != record.from {
                return VerifyResult {
                    valid: false,
                    depth,
                    root_owner,
                    reason: Some(format!(
                        "Broken chain at index {}: expected from='{}', got '{}'",
                        i, prev.to, record.from
                    )),
                };
            }
            if prev.to_public_key_digest != record.from_public_key_digest {
                return VerifyResult {
                    valid: false,
                    depth,
                    root_owner,
                    reason: Some(format!(
                        "PKD mismatch at index {}: toPublicKeyDigest[{}] != fromPublicKeyDigest[{}]",
                        i,
                        i - 1,
                        i
                    )),
                };
            }
        }

        if !verify_transfer_key(&record.transfer_key, &record.from_public_key_digest) {
            return VerifyResult {
                valid: false,
                depth,
                root_owner,
                reason: Some(format!(
                    "Transfer key does not match prior owner public key at index {} (from='{}')",
                    i, record.from
                )),
            };
        }

        if record.tx_body_hex.is_empty() {
            return VerifyResult {
                valid: false,
                depth,
                root_owner,
                reason: Some(format!(
                    "Missing txBodyHex at transfer index {} (from='{}')",
                    i, record.from
                )),
            };
        }

        let tx_body_bytes = match hex_to_bytes(&record.tx_body_hex) {
            Ok(b) => b,
            Err(_) => {
                return VerifyResult {
                    valid: false,
                    depth,
                    root_owner,
                    reason: Some(format!("Invalid txBodyHex hex at index {}", i)),
                };
            }
        };

        let recomputed_digest = sha3_256_hex(&tx_body_bytes);
        if recomputed_digest != record.signed_digest {
            return VerifyResult {
                valid: false,
                depth,
                root_owner,
                reason: Some(format!(
                    "signedDigest mismatch at index {}: stored digest does not match sha3_256(txBodyHex) — possible TX data tampering",
                    i
                )),
            };
        }

        let commitment = match hex_to_bytes(&record.signed_digest) {
            Ok(b) => b,
            Err(_) => {
                return VerifyResult {
                    valid: false,
                    depth,
                    root_owner,
                    reason: Some(format!("Invalid signedDigest hex at index {}", i)),
                };
            }
        };

        if !verify_blind_sig(&record.blinded_signature, &commitment, &chain.se_public_key) {
            return VerifyResult {
                valid: false,
                depth,
                root_owner,
                reason: Some(format!(
                    "Invalid SE blind signature at transfer index {} (from='{}' to='{}')",
                    i, record.from, record.to
                )),
            };
        }

        if record.owner_signature.is_empty() {
            return VerifyResult {
                valid: false,
                depth,
                root_owner,
                reason: Some(format!(
                    "Missing ownerSignature at transfer index {} (from='{}')",
                    i, record.from
                )),
            };
        }

        if !verify_owner_sig(&record.owner_signature, &commitment, &record.from_public_key_digest) {
            return VerifyResult {
                valid: false,
                depth,
                root_owner,
                reason: Some(format!(
                    "Invalid owner signature at transfer index {} (from='{}')",
                    i, record.from
                )),
            };
        }
    }

    let last = &history[history.len() - 1];
    if last.to != chain.current_owner.party_id {
        return VerifyResult {
            valid: false,
            depth,
            root_owner,
            reason: Some(format!(
                "currentOwner '{}' does not match last transfer recipient '{}'",
                chain.current_owner.party_id, last.to
            )),
        };
    }
    if last.to_public_key_digest != chain.current_owner.public_key_digest {
        return VerifyResult {
            valid: false,
            depth,
            root_owner,
            reason: Some(format!(
                "currentOwner PKD mismatch: history '{}…' != state '{}…'",
                &last.to_public_key_digest[..8.min(last.to_public_key_digest.len())],
                &chain.current_owner.public_key_digest[..8.min(chain.current_owner.public_key_digest.len())]
            )),
        };
    }

    VerifyResult {
        valid: true,
        depth,
        root_owner,
        reason: None,
    }
}
