use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WotsProof {
    pub address: String,
    #[serde(rename = "publicKey")]
    pub public_key: String,
    pub signature: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OwnershipProof {
    #[serde(rename = "rootAddress")]
    pub root_address: String,
    #[serde(rename = "rootPublicKey")]
    pub root_public_key: String,
    #[serde(rename = "childAddresses")]
    pub child_addresses: Vec<String>,
    #[serde(rename = "childPublicKeys")]
    pub child_public_keys: Vec<String>,
    #[serde(rename = "rootProof")]
    pub root_proof: WotsProof,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyResult {
    pub valid: bool,
    pub reason: Option<String>,
}
