use crate::canonical::manifest_digest;
use crate::types::{SignedManifest, VerifyResult};

fn manifest_address_field(manifest: &serde_json::Value) -> String {
    match manifest["type"].as_str().unwrap_or("") {
        "app" => manifest["authorAddress"].as_str().unwrap_or("").to_string(),
        "capability" => manifest["agentAddress"].as_str().unwrap_or("").to_string(),
        "dapp" => manifest["authorAddress"].as_str().unwrap_or("").to_string(),
        "edge-service" => manifest["operatorAddress"].as_str().unwrap_or("").to_string(),
        _ => String::new(),
    }
}

pub fn verify_manifest(
    signed: &SignedManifest,
    verify_sig_fn: &dyn Fn(&str, &[u8], &str) -> bool,
    address_from_pubkey_fn: &dyn Fn(&str) -> Option<String>,
) -> VerifyResult {
    let digest = manifest_digest(&signed.manifest);

    if !verify_sig_fn(&signed.signature, &digest, &signed.signer_public_key) {
        return VerifyResult {
            valid: false,
            reason: Some("WOTS signature invalid".to_string()),
            signer_address: signed.author_address.clone(),
        };
    }

    // The signature proves control of signer_public_key. The claimed author must
    // be the address derived from that key, otherwise an attacker can sign a
    // manifest that declares a victim address and copy it into the wrapper.
    let derived_address = match address_from_pubkey_fn(&signed.signer_public_key) {
        Some(address) if !address.is_empty() => address,
        _ => {
            return VerifyResult {
                valid: false,
                reason: Some("signerPublicKey cannot derive an address".to_string()),
                signer_address: signed.author_address.clone(),
            };
        }
    };

    if signed.author_address != derived_address {
        return VerifyResult {
            valid: false,
            reason: Some(format!(
                "authorAddress mismatch: signed by '{}' but wrapper claims '{}'",
                derived_address, signed.author_address
            )),
            signer_address: derived_address,
        };
    }

    let expected_address = manifest_address_field(&signed.manifest);
    if expected_address != derived_address {
        return VerifyResult {
            valid: false,
            reason: Some(format!(
                "authorAddress mismatch: signed by '{}' but manifest declares '{}'",
                derived_address, expected_address
            )),
            signer_address: derived_address,
        };
    }

    VerifyResult {
        valid: true,
        reason: None,
        signer_address: derived_address,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn signed_manifest() -> SignedManifest {
        SignedManifest {
            manifest: json!({
                "type": "app",
                "authorAddress": "MxOWNER"
            }),
            author_address: "MxOWNER".to_string(),
            signer_public_key: "PKDIGEST".to_string(),
            signed_at: 1,
            signature: "SIG".to_string(),
            root_identity_proof: None,
        }
    }

    #[test]
    fn accepts_matching_derived_address() {
        let result = verify_manifest(
            &signed_manifest(),
            &|_, _, _| true,
            &|_| Some("MxOWNER".to_string()),
        );
        assert!(result.valid);
    }

    #[test]
    fn rejects_claimed_author_not_derived_from_signer() {
        let result = verify_manifest(
            &signed_manifest(),
            &|_, _, _| true,
            &|_| Some("MxATTACKER".to_string()),
        );
        assert!(!result.valid);
        assert!(result.reason.unwrap_or_default().contains("authorAddress"));
    }
}
