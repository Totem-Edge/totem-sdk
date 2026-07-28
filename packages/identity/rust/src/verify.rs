use crate::canonical::claim_digest;
use crate::types::{IdentityVerifyResult, SignedIdentityClaim};

pub fn verify_identity_claim(
    signed: &SignedIdentityClaim,
    verify_sig_fn: &dyn Fn(&str, &[u8], &str) -> bool,
) -> IdentityVerifyResult {
    let claim_json = serde_json::to_value(&signed.claim).unwrap_or_default();
    let digest = claim_digest(&claim_json);

    if !verify_sig_fn(&signed.proof.signature, &digest, &signed.proof.public_key) {
        return IdentityVerifyResult {
            valid: false,
            reason: Some("WOTS signature invalid".to_string()),
            signer_address: Some(signed.proof.address.clone()),
            root_address: None,
        };
    }

    IdentityVerifyResult {
        valid: true,
        reason: None,
        signer_address: Some(signed.proof.address.clone()),
        root_address: None,
    }
}
