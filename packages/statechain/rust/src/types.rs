use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StatechainStatus {
    #[serde(rename = "active")]
    Active,
    #[serde(rename = "claiming")]
    Claiming,
    #[serde(rename = "claimed")]
    Claimed,
    #[serde(rename = "abandoned")]
    Abandoned,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatechainOwner {
    #[serde(rename = "partyId")]
    pub party_id: String,
    #[serde(rename = "publicKeyDigest")]
    pub public_key_digest: String,
    #[serde(rename = "transferKeySeed")]
    pub transfer_key_seed: Option<String>,
    #[serde(rename = "address")]
    pub address: Option<String>,
    #[serde(rename = "tokenId")]
    pub token_id: Option<String>,
    pub amount: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferRecord {
    pub from: String,
    pub to: String,
    #[serde(rename = "fromPublicKeyDigest")]
    pub from_public_key_digest: String,
    #[serde(rename = "toPublicKeyDigest")]
    pub to_public_key_digest: String,
    #[serde(rename = "blindedSignature")]
    pub blinded_signature: String,
    #[serde(rename = "transferKey")]
    pub transfer_key: String,
    #[serde(rename = "ownerSignature")]
    pub owner_signature: String,
    #[serde(rename = "signedDigest")]
    pub signed_digest: String,
    #[serde(rename = "txBodyHex")]
    pub tx_body_hex: String,
    #[serde(rename = "txHex")]
    pub tx_hex: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimPayload {
    #[serde(rename = "chainId")]
    pub chain_id: String,
    #[serde(rename = "coinId")]
    pub coin_id: String,
    #[serde(rename = "claimAddress")]
    pub claim_address: String,
    #[serde(rename = "txHex")]
    pub tx_hex: String,
    #[serde(rename = "txpowId")]
    pub txpow_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbandonedProof {
    #[serde(rename = "timelockBlock")]
    pub timelock_block: Option<u64>,
    pub evidence: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateChain {
    #[serde(rename = "chainId")]
    pub chain_id: String,
    #[serde(rename = "coinId")]
    pub coin_id: String,
    #[serde(rename = "tokenId")]
    pub token_id: String,
    pub amount: String,
    #[serde(rename = "sePublicKey")]
    pub se_public_key: String,
    #[serde(rename = "lockingScript")]
    pub locking_script: String,
    #[serde(rename = "lockingAddress")]
    pub locking_address: String,
    #[serde(rename = "currentOwner")]
    pub current_owner: StatechainOwner,
    #[serde(rename = "transferHistory")]
    pub transfer_history: Vec<TransferRecord>,
    pub status: StatechainStatus,
    #[serde(rename = "reclaimTx")]
    pub reclaim_tx: String,
    #[serde(rename = "reclaimAddress")]
    pub reclaim_address: String,
    #[serde(rename = "reclaimTimelock")]
    pub reclaim_timelock: u64,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyResult {
    pub valid: bool,
    pub depth: u32,
    #[serde(rename = "rootOwner")]
    pub root_owner: String,
    pub reason: Option<String>,
}
