use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TotemIdentityDocument {
    pub id: String,
    pub kind: String,
    pub version: u32,
    #[serde(rename = "rootAddress")]
    pub root_address: String,
    #[serde(rename = "controllerAddress")]
    pub controller_address: String,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityClaim {
    pub id: String,
    #[serde(rename = "type")]
    pub claim_type: String,
    pub issuer: String,
    pub subject: String,
    pub object: String,
    #[serde(rename = "issuedAt")]
    pub issued_at: u64,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<u64>,
    pub payload: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimProof {
    pub address: String,
    #[serde(rename = "publicKey")]
    pub public_key: String,
    pub signature: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedIdentityClaim {
    pub claim: IdentityClaim,
    pub proof: ClaimProof,
    #[serde(rename = "rootIdentityProof")]
    pub root_identity_proof: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityVerifyResult {
    pub valid: bool,
    pub reason: Option<String>,
    #[serde(rename = "signerAddress")]
    pub signer_address: Option<String>,
    #[serde(rename = "rootAddress")]
    pub root_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityGraph {
    pub document: TotemIdentityDocument,
    pub claims: Vec<SignedIdentityClaim>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedIdentity {
    pub status: String,
    #[serde(rename = "rootAddress")]
    pub root_address: String,
    #[serde(rename = "controllerAddress")]
    pub controller_address: String,
    pub delegates: Vec<DelegateEntry>,
    #[serde(rename = "paymentRecipients")]
    pub payment_recipients: Vec<String>,
    #[serde(rename = "serviceEndpoints")]
    pub service_endpoints: Vec<ServiceEndpointEntry>,
    #[serde(rename = "controlledAddresses")]
    pub controlled_addresses: Vec<String>,
    #[serde(rename = "authorizedAddresses")]
    pub authorized_addresses: Vec<String>,
    #[serde(rename = "rotatedTo")]
    pub rotated_to: Option<String>,
    pub revoked: bool,
    #[serde(rename = "revocationReason")]
    pub revocation_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegateEntry {
    #[serde(rename = "delegatedAddress")]
    pub delegated_address: String,
    pub scopes: Vec<String>,
    #[serde(rename = "claimId")]
    pub claim_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceEndpointEntry {
    #[serde(rename = "endpointType")]
    pub endpoint_type: String,
    pub uri: String,
    #[serde(rename = "claimId")]
    pub claim_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityResolutionResult {
    pub resolved: Option<ResolvedIdentity>,
    pub errors: Vec<String>,
}
