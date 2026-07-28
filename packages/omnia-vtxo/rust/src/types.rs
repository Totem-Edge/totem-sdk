use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OmniaVtxo {
    #[serde(rename = "vtxoId")]
    pub vtxo_id: String,
    #[serde(rename = "poolId")]
    pub pool_id: String,
    pub owner: String,
    pub amount: String,
    #[serde(rename = "tokenId")]
    pub token_id: String,
    pub nonce: String,
    pub status: String,
    pub epoch: u64,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    #[serde(rename = "proofHash")]
    pub proof_hash: String,
    #[serde(rename = "merkleProof")]
    pub merkle_proof: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OmniaVtxoPool {
    #[serde(rename = "poolId")]
    pub pool_id: String,
    pub operator: String,
    #[serde(rename = "tokenId")]
    pub token_id: String,
    pub nonce: String,
    pub capacity: String,
    pub minted: String,
    #[serde(rename = "commitmentRoot")]
    pub commitment_root: String,
    pub epoch: u64,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyVtxoResult {
    pub valid: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VtxoTransfer {
    #[serde(rename = "transferId")]
    pub transfer_id: String,
    pub input: OmniaVtxo,
    pub output: OmniaVtxo,
    pub change: Option<OmniaVtxo>,
    #[serde(rename = "transferredAt")]
    pub transferred_at: u64,
}
