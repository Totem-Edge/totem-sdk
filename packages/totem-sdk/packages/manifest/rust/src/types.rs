use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppManifest {
    #[serde(rename = "type")]
    pub manifest_type: String,
    #[serde(rename = "appId")]
    pub app_id: String,
    pub name: String,
    pub version: String,
    #[serde(rename = "authorAddress")]
    pub author_address: String,
    #[serde(rename = "pearTopicKey")]
    pub pear_topic_key: String,
    pub price: String,
    #[serde(rename = "priceToken")]
    pub price_token: Option<String>,
    #[serde(rename = "subscriptionInterval")]
    pub subscription_interval: Option<u32>,
    pub category: Vec<String>,
    pub permissions: Vec<String>,
    #[serde(rename = "iconCid")]
    pub icon_cid: Option<String>,
    pub description: String,
    #[serde(rename = "repoUrl")]
    pub repo_url: Option<String>,
    #[serde(rename = "minTotemVersion")]
    pub min_totem_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityManifest {
    #[serde(rename = "type")]
    pub manifest_type: String,
    #[serde(rename = "capabilityId")]
    pub capability_id: String,
    #[serde(rename = "capabilityName")]
    pub capability_name: String,
    #[serde(rename = "agentAddress")]
    pub agent_address: String,
    #[serde(rename = "agentIdentityKey")]
    pub agent_identity_key: String,
    pub description: String,
    #[serde(rename = "inputSchema")]
    pub input_schema: serde_json::Value,
    #[serde(rename = "outputSchema")]
    pub output_schema: serde_json::Value,
    #[serde(rename = "pricePerCall")]
    pub price_per_call: String,
    #[serde(rename = "priceToken")]
    pub price_token: Option<String>,
    #[serde(rename = "paymentChannel")]
    pub payment_channel: Option<String>,
    #[serde(rename = "maxLatencyMs")]
    pub max_latency_ms: Option<u64>,
    #[serde(rename = "maxCallsPerMinute")]
    pub max_calls_per_minute: Option<u32>,
    #[serde(rename = "expiresAt")]
    pub expires_at: u64,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DAppManifest {
    #[serde(rename = "type")]
    pub manifest_type: String,
    #[serde(rename = "dappId")]
    pub dapp_id: String,
    pub name: String,
    pub version: String,
    #[serde(rename = "authorAddress")]
    pub author_address: String,
    #[serde(rename = "contractHash")]
    pub contract_hash: String,
    #[serde(rename = "contractSource")]
    pub contract_source: Option<String>,
    pub abi: Vec<DAppAbiEntry>,
    pub price: String,
    #[serde(rename = "priceToken")]
    pub price_token: Option<String>,
    pub category: Vec<String>,
    pub description: String,
    #[serde(rename = "auditReport")]
    pub audit_report: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DAppAbiEntry {
    pub name: String,
    pub description: String,
    pub params: Vec<AbiParam>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbiParam {
    pub name: String,
    #[serde(rename = "type")]
    pub param_type: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdgeServiceManifest {
    #[serde(rename = "type")]
    pub manifest_type: String,
    #[serde(rename = "serviceId")]
    pub service_id: String,
    pub name: String,
    pub version: String,
    #[serde(rename = "operatorAddress")]
    pub operator_address: String,
    #[serde(rename = "serviceType")]
    pub service_type: String,
    pub description: String,
    pub endpoints: Option<Vec<ServiceEndpoint>>,
    pub capabilities: Vec<String>,
    pub price: Option<String>,
    #[serde(rename = "priceToken")]
    pub price_token: Option<String>,
    #[serde(rename = "paymentMethods")]
    pub payment_methods: Option<Vec<String>>,
    pub tags: Vec<String>,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<u64>,
    #[serde(rename = "minTotemVersion")]
    pub min_totem_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceEndpoint {
    #[serde(rename = "type")]
    pub endpoint_type: String,
    pub uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedManifest {
    pub manifest: serde_json::Value,
    #[serde(rename = "authorAddress")]
    pub author_address: String,
    #[serde(rename = "signerPublicKey")]
    pub signer_public_key: String,
    #[serde(rename = "signedAt")]
    pub signed_at: u64,
    pub signature: String,
    #[serde(rename = "rootIdentityProof")]
    pub root_identity_proof: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyResult {
    pub valid: bool,
    pub reason: Option<String>,
    #[serde(rename = "signerAddress")]
    pub signer_address: String,
}
