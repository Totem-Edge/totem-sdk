use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofGraphNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    #[serde(rename = "refId")]
    pub ref_id: String,
    pub data: Option<HashMap<String, serde_json::Value>>,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofGraphEdge {
    pub id: String,
    #[serde(rename = "type")]
    pub edge_type: String,
    pub from: String,
    pub to: String,
    #[serde(rename = "proofId")]
    pub proof_id: Option<String>,
    pub data: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofGraph {
    #[serde(rename = "graphId")]
    pub graph_id: String,
    pub nodes: Vec<ProofGraphNode>,
    pub edges: Vec<ProofGraphEdge>,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofGraphVerifyResult {
    pub valid: bool,
    #[serde(rename = "invalidProofs")]
    pub invalid_proofs: Vec<String>,
    pub reason: Option<String>,
}
