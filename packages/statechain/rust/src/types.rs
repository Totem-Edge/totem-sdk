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
    /// TreeKey **root** public key hex (RFC-009) — bound by STATE(0)/SIGNEDBY.
    #[serde(rename = "publicKeyDigest")]
    pub public_key_digest: String,
    #[serde(rename = "address")]
    pub address: Option<String>,
    #[serde(rename = "tokenId")]
    pub token_id: Option<String>,
    pub amount: Option<String>,
}

/// RFC-008 / RFC-009 leased-leaf SE signature envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeSignature {
    /// `child` = off-chain transfer blind-signature; `root` = claim co-signature.
    pub kind: String,
    pub member: String,
    #[serde(rename = "childIndex")]
    pub child_index: u32,
    pub address: String,
    #[serde(rename = "publicKey")]
    pub public_key: String,
    /// Serialized one-time `TreeSignature` hex.
    pub signature: String,
    pub message: String,
    #[serde(rename = "proofVersion")]
    pub proof_version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeRootProof {
    pub address: String,
    #[serde(rename = "publicKey")]
    pub public_key: String,
    pub signature: String,
    pub message: String,
}

/// SE root identity + authorized leaf set (RFC-008).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeOwnershipProof {
    #[serde(rename = "rootAddress")]
    pub root_address: String,
    #[serde(rename = "rootPublicKey")]
    pub root_public_key: String,
    #[serde(rename = "childAddresses")]
    pub child_addresses: Vec<String>,
    #[serde(rename = "childPublicKeys")]
    pub child_public_keys: Vec<String>,
    #[serde(rename = "rootProof")]
    pub root_proof: SeRootProof,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferRecord {
    pub from: String,
    pub to: String,
    #[serde(rename = "fromPublicKeyDigest")]
    pub from_public_key_digest: String,
    #[serde(rename = "toPublicKeyDigest")]
    pub to_public_key_digest: String,
    /// RFC-008 SE signature envelope (leased one-time leaf).
    #[serde(rename = "seSignature")]
    pub se_signature: Option<SeSignature>,
    /// Old owner's serialized Minima `TreeSignature` hex over `signedDigest`.
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
    /// RFC-008: published SE root identity + authorized leaf set.
    #[serde(rename = "seOwnershipProof")]
    pub se_ownership_proof: Option<SeOwnershipProof>,
    /// RFC-008: monotonic SE identity-proof version.
    #[serde(rename = "seProofVersion")]
    pub se_proof_version: Option<u32>,
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
