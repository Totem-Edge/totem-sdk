use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SigningIndices {
    #[serde(rename = "addressIndex")]
    pub address_index: u32,
    pub l1: u32,
    pub l2: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofSubject {
    pub id: String,
    pub kind: String,
    pub address: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceRef {
    pub id: String,
    pub kind: String,
    pub hash: String,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnchorRef {
    pub provider: String,
    pub hash: String,
    #[serde(rename = "txId")]
    pub tx_id: Option<String>,
    #[serde(rename = "confirmedAt")]
    pub confirmed_at: Option<u64>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofLink {
    #[serde(rename = "proofId")]
    pub proof_id: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnsignedProof {
    #[serde(rename = "proofId")]
    pub proof_id: String,
    pub kind: String,
    pub subject: ProofSubject,
    pub issuer: String,
    #[serde(rename = "issuedAt")]
    pub issued_at: u64,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<u64>,
    pub evidence: Option<Vec<EvidenceRef>>,
    pub links: Option<Vec<ProofLink>>,
    pub payload: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofSignature {
    pub address: String,
    #[serde(rename = "publicKey")]
    pub public_key: String,
    pub signature: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedProof {
    #[serde(rename = "proofId")]
    pub proof_id: String,
    pub kind: String,
    pub subject: ProofSubject,
    pub issuer: String,
    #[serde(rename = "issuedAt")]
    pub issued_at: u64,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<u64>,
    pub evidence: Option<Vec<EvidenceRef>>,
    pub links: Option<Vec<ProofLink>>,
    pub payload: Option<HashMap<String, serde_json::Value>>,
    pub signature: ProofSignature,
    pub anchor: Option<AnchorRef>,
    #[serde(rename = "rootIdentityProof")]
    pub root_identity_proof: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofVerifyResult {
    pub valid: bool,
    pub expired: Option<bool>,
    pub reason: Option<String>,
    #[serde(rename = "signerAddress")]
    pub signer_address: Option<String>,
}
