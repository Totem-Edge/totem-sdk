use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactoryParticipant {
    #[serde(rename = "partyId")]
    pub party_id: String,
    #[serde(rename = "publicKeyDigest")]
    pub public_key_digest: String,
    #[serde(rename = "addressIndex")]
    pub address_index: u32,
    #[serde(rename = "contributionAmount")]
    pub contribution_amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelFactory {
    #[serde(rename = "factoryId")]
    pub factory_id: String,
    pub participants: Vec<FactoryParticipant>,
    #[serde(rename = "totalValue")]
    pub total_value: String,
    #[serde(rename = "tokenId")]
    pub token_id: String,
    pub allocations: HashMap<String, String>,
    #[serde(rename = "virtualChannels")]
    pub virtual_channels: Vec<serde_json::Value>,
    #[serde(rename = "currentSequence")]
    pub current_sequence: u32,
    pub status: String,
    #[serde(rename = "fundingScript")]
    pub funding_script: String,
    #[serde(rename = "fundingAddress")]
    pub funding_address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub reason: Option<String>,
}
