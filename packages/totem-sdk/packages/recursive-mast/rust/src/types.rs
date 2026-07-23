use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyNode {
    pub id: String,
    pub name: String,
    #[serde(rename = "scriptHash")]
    pub script_hash: String,
    pub script: String,
    #[serde(rename = "policyRoot")]
    pub policy_root: String,
    pub children: Vec<PolicyNode>,
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyTree {
    pub root: PolicyNode,
    #[serde(rename = "nodeMap")]
    pub node_map: HashMap<String, PolicyNode>,
    pub depth: u32,
    #[serde(rename = "nodeCount")]
    pub node_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofLink {
    #[serde(rename = "scriptHash")]
    pub script_hash: String,
    #[serde(rename = "policyRoot")]
    pub policy_root: String,
    pub proof: String,
    pub script: String,
    #[serde(rename = "leafSum")]
    pub leaf_sum: Option<String>,
    #[serde(rename = "rootSum")]
    pub root_sum: Option<String>,
    pub label: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofChain {
    pub links: Vec<ProofLink>,
    pub depth: u32,
    pub verified: bool,
    #[serde(rename = "leafScriptHash")]
    pub leaf_script_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegationConstraints {
    #[serde(rename = "maxBlock")]
    pub max_block: Option<u64>,
    #[serde(rename = "maxAmount")]
    pub max_amount: Option<String>,
    pub scopes: Option<Vec<String>>,
    #[serde(rename = "coSigners")]
    pub co_signers: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegationLink {
    pub delegator: String,
    pub delegate: String,
    #[serde(rename = "policyRoot")]
    pub policy_root: String,
    pub proof: String,
    pub script: String,
    pub constraints: DelegationConstraints,
    pub sequence: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegationChain {
    pub links: Vec<DelegationLink>,
    #[serde(rename = "rootAuthority")]
    pub root_authority: String,
    #[serde(rename = "currentDelegate")]
    pub current_delegate: String,
    pub verified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub valid: bool,
    #[serde(rename = "failedAt")]
    pub failed_at: Option<u32>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyNodeInput {
    pub id: String,
    pub name: String,
    pub script: String,
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentKey {
    pub prefix: String,
    pub parts: Vec<String>,
    pub key: String,
}
