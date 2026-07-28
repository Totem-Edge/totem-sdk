use crate::id::compute_claim_id;
use crate::types::IdentityClaim;

pub fn create_identity_claim(
    claim_type: &str,
    issuer: &str,
    subject: &str,
    object: &str,
    issued_at: u64,
    expires_at: Option<u64>,
    payload: Option<serde_json::Value>,
) -> IdentityClaim {
    let id = compute_claim_id(claim_type, issuer, subject, object, issued_at, payload.as_ref());
    IdentityClaim {
        id,
        claim_type: claim_type.to_string(),
        issuer: issuer.to_string(),
        subject: subject.to_string(),
        object: object.to_string(),
        issued_at,
        expires_at,
        payload: payload.and_then(|p| {
            if let serde_json::Value::Object(map) = p {
                Some(map.into_iter().collect())
            } else {
                None
            }
        }),
    }
}

pub fn create_delegation_claim(
    issuer: &str,
    subject: &str,
    delegate_address: &str,
    scopes: &[String],
    issued_at: u64,
    expires_at: Option<u64>,
) -> IdentityClaim {
    let payload = serde_json::json!({ "scopes": scopes });
    create_identity_claim("delegates_to", issuer, subject, delegate_address, issued_at, expires_at, Some(payload))
}

pub fn create_payment_recipient_claim(
    issuer: &str,
    subject: &str,
    recipient_address: &str,
    issued_at: u64,
    expires_at: Option<u64>,
) -> IdentityClaim {
    create_identity_claim("payment_recipient", issuer, subject, recipient_address, issued_at, expires_at, None)
}

pub fn create_service_endpoint_claim(
    issuer: &str,
    subject: &str,
    endpoint_type: &str,
    uri: &str,
    issued_at: u64,
    expires_at: Option<u64>,
) -> IdentityClaim {
    let payload = serde_json::json!({ "endpointType": endpoint_type, "uri": uri });
    create_identity_claim("service_endpoint", issuer, subject, uri, issued_at, expires_at, Some(payload))
}

pub fn create_rotation_claim(
    issuer: &str,
    subject: &str,
    new_address: &str,
    issued_at: u64,
) -> IdentityClaim {
    create_identity_claim("rotates_to", issuer, subject, new_address, issued_at, None, None)
}

pub fn create_revocation_claim(
    issuer: &str,
    subject: &str,
    reason: Option<&str>,
    issued_at: u64,
) -> IdentityClaim {
    let payload = reason.map(|r| serde_json::json!({ "reason": r }));
    create_identity_claim("revokes", issuer, subject, subject, issued_at, None, payload)
}
