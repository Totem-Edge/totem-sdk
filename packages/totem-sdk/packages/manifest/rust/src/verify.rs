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
) -> VerifyResult {
    let digest = manifest_digest(&signed.manifest);

    if !verify_sig_fn(&signed.signature, &digest, &signed.signer_public_key) {
        return VerifyResult {
            valid: false,
            reason: Some("WOTS signature invalid".to_string()),
            signer_address: signed.author_address.clone(),
        };
    }

    let expected_address = manifest_address_field(&signed.manifest);
    if signed.author_address != expected_address {
        return VerifyResult {
            valid: false,
            reason: Some(format!(
                "authorAddress mismatch: signed by '{}' but manifest declares '{}'",
                signed.author_address, expected_address
            )),
            signer_address: signed.author_address.clone(),
        };
    }

    VerifyResult {
        valid: true,
        reason: None,
        signer_address: signed.author_address.clone(),
    }
}
